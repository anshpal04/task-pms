const { verifyAccessToken } = require("../utils/jwt");
const User = require("../models/User");

// ─── verifyToken ──────────────────────────────────────────────────────────────
// This middleware:
// 1. Reads the token from the request header
// 2. Verifies it's valid and not expired
// 3. Finds the user in DB and attaches them to req.user
// 4. Calls next() to continue to the actual route handler
//
// If anything fails, it sends a 401 error and STOPS (never calls next())

const verifyToken = async (req, res, next) => {
  try {
    let token;

    // Tokens come in the Authorization header as: "Bearer eyJhb..."
    // We split on space and take the second part
    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }
    // OR from a cookie (we'll set this up later)
    else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Please log in.",
      });
    }

    // Decode the token — this will throw if expired or tampered with
    const decoded = verifyAccessToken(token);
    // decoded now contains: { id, email, role, iat, exp }

    // Double-check user still exists in DB (could have been deleted)
    const user = await User.findById(decoded.id).select(
      "_id email role isActive",
    );

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User not found or account deactivated.",
      });
    }

    // Attach user info to the request object
    // Now any route after this middleware can access req.user
    req.user = { id: user._id, email: user.email, role: user.role };

    next(); // ✅ all good, move to the next function
  } catch (error) {
    // JWT throws TokenExpiredError when the token is past its expiry time
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please refresh.",
        code: "TOKEN_EXPIRED", // frontend reads this to trigger a refresh
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid token.",
    });
  }
};

// ─── authorizeRoles ───────────────────────────────────────────────────────────
// This is a FACTORY FUNCTION — it returns a middleware function
// Usage: router.get('/admin', verifyToken, authorizeRoles('admin'), controller)
//
// We make it a factory so we can pass in which roles are allowed:
// authorizeRoles('admin')          → only admin
// authorizeRoles('admin', 'user')  → both

const authorizeRoles = (...roles) => {
  // The returned function IS the middleware
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated." });
    }

    // Check if the user's role is in the allowed roles array
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        // 403 = Forbidden (you're logged in, but not allowed)
        success: false,
        message: `Access denied. Requires: ${roles.join(" or ")}. You are: ${req.user.role}`,
      });
    }

    next(); // ✅ role is allowed
  };
};

// Shortcuts for cleaner route code
const isAdmin = authorizeRoles("admin");
const isUser = authorizeRoles("user", "admin"); // admins can access user routes too

module.exports = { verifyToken, authorizeRoles, isAdmin, isUser };
