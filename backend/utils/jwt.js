const jwt = require("jsonwebtoken");

// Generate a token containing the user's ID and Role
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: "30d", // Token lasts for 30 days
  });
};

module.exports = generateToken;
