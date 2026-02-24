const jwt = require("jsonwebtoken");
const User = require("../models/user");

exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.debug("JWT decoded:", decoded);

      req.user = await User.findById(decoded.userId).select("-password");

      return next();
    } catch (error) {
      return res.status(401).json({ message: "Not authorized" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "No token" });
  }
};

exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // Debug info for role mismatch
    if (!roles.includes(req.user.role)) {
      console.warn(`Access denied. Required role(s): ${roles.join(",")}, user role: ${req.user.role}`);
      return res.status(403).json({ message: "Forbidden: insufficient role", required: roles, userRole: req.user.role });
    }

    next();
  };
};