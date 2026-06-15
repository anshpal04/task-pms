const jwt = require("jsonwebtoken");

// jwt.sign(payload, secret, options) creates a token
// payload = data we want to store inside the token (user id, role)
// secret = private key — if someone knows this, they can forge tokens
// options.expiresIn = when the token becomes invalid

const generateAccessToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES }, // '15m'
  );
};

const generateRefreshToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES }, // '7d'
  );
};

// jwt.verify() decodes AND checks if the token is valid + not expired
// If invalid, it throws an error — we catch that in middleware

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

// Calculate when a refresh token expires (to store in MongoDB)
const getRefreshTokenExpiry = () => {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7); // 7 days from now
  return expiry;
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
};
