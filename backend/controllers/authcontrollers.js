const { validationResult } = require("express-validator");
const User = require("../models/User");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
} = require("../utils/jwt");

// Cookie settings for the refresh token
// httpOnly: true  → JS cannot read this cookie (blocks XSS attacks)
// secure: true    → only sent over HTTPS (in production)
// sameSite: strict → only sent to same site (blocks CSRF attacks)
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};

// ─── Helper: sendTokenResponse ────────────────────────────────────────────────
// We call this after register AND login — avoids repeating code
const sendTokenResponse = async (user, statusCode, res) => {
  // Build the payload — what goes INSIDE the token
  // Keep it small: just what you need to identify the user
  const payload = { id: user._id, email: user.email, role: user.role };

  const accessToken = generateAccessToken(payload); // lives 15 minutes
  const refreshToken = generateRefreshToken(payload); // lives 7 days

  // Save refresh token to DB so we can:
  // 1. Validate it on refresh (prevent forged tokens)
  // 2. Delete it on logout (true logout)
  // 3. Detect reuse (security)
  user.cleanExpiredTokens(); // remove old expired ones first
  user.refreshTokens.push({
    token: refreshToken,
    expiresAt: getRefreshTokenExpiry(),
  });
  user.lastLogin = new Date();
  await user.save();

  // Set refresh token as httpOnly cookie — frontend never sees this directly
  res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);

  // Send access token in JSON body — frontend stores this in memory
  res.status(statusCode).json({
    success: true,
    accessToken, // short-lived, used for API calls
    user: user.toSafeObject(), // safe user data (no password)
  });
};

// ─── REGISTER ─────────────────────────────────────────────────────────────────
const register = async (req, res) => {
  // Check if express-validator found any errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { name, email, password } = req.body;

  try {
    // Check if email already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({
        // 409 = Conflict
        success: false,
        message: "This email is already registered.",
      });
    }

    // Create user — password will be hashed by the pre-save middleware we wrote
    const user = await User.create({ name, email, password });

    // Send back tokens
    await sendTokenResponse(user, 201, res); // 201 = Created
  } catch (error) {
    console.error("Register error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error during registration." });
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // We need password for comparison, but schema has select:false
    // So we explicitly ask for it with .select('+password')
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      // Don't say "email not found" — that tells attackers which emails exist
      // Always say "email or password wrong"
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    }

    if (!user.isActive) {
      return res
        .status(403)
        .json({ success: false, message: "Account has been deactivated." });
    }

    // Use our model method to compare against the hash
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    }

    await sendTokenResponse(user, 200, res); // 200 = OK
  } catch (error) {
    console.error("Login error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error during login." });
  }
};

// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────
// Called when the access token expires (frontend does this automatically)
const refreshToken = async (req, res) => {
  // Read refresh token from the httpOnly cookie
  const token = req.cookies?.refreshToken;

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "No refresh token provided." });
  }

  try {
    const decoded = verifyRefreshToken(token);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found." });
    }

    // Check this exact token exists in our DB
    const storedToken = user.refreshTokens.find((t) => t.token === token);

    if (!storedToken) {
      // Token not in DB means either:
      // 1. User already logged out
      // 2. Token was stolen and already used (reuse attack!)
      // Clear ALL tokens for this user as a security measure
      user.refreshTokens = [];
      await user.save();
      return res.status(401).json({
        success: false,
        message: "Token reuse detected. Please log in again.",
      });
    }

    // Remove the old refresh token (rotation — issue a fresh one)
    user.refreshTokens = user.refreshTokens.filter((t) => t.token !== token);

    // Issue new access + refresh tokens
    await sendTokenResponse(user, 200, res);
  } catch (error) {
    res.clearCookie("refreshToken");
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired refresh token." });
  }
};

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
const logout = async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (token) {
    try {
      const decoded = verifyRefreshToken(token);
      const user = await User.findById(decoded.id);
      if (user) {
        // Remove ONLY this device's refresh token
        // (user might be logged in on phone + laptop — don't log out all devices)
        user.refreshTokens = user.refreshTokens.filter(
          (t) => t.token !== token,
        );
        await user.save();
      }
    } catch (_) {
      // Token may be expired — we still want to clear the cookie
    }
  }

  res.clearCookie("refreshToken");
  res.json({ success: true, message: "Logged out successfully." });
};

// ─── GET CURRENT USER ─────────────────────────────────────────────────────────
// Protected route — verifyToken middleware runs before this
// req.user is already set by the middleware
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }
    res.json({ success: true, user: user.toSafeObject() });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── ADMIN: LIST ALL USERS ────────────────────────────────────────────────────
const getAllUsers = async (req, res) => {
  try {
    // Exclude sensitive fields from results
    const users = await User.find({})
      .select("-refreshTokens")
      .sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, users });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = { register, login, refreshToken, logout, getMe, getAllUsers };
