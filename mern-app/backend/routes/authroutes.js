const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/user");

const router = express.Router();

/*
POST /api/auth/register
Participant only
*/
router.post(
  "/register",
  body("email").isEmail(),
  body("password").isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Accept either `name` or `firstName` + `lastName` for flexibility
      const { name, firstName, lastName, email, password } = req.body;

      if ((!name && (!firstName || !lastName)) || !email || !password) {
        return res.status(400).json({ message: "Name (or firstName+lastName), email and password are required" });
      }

      // Determine participantType based on email
      const participantType = email.endsWith("@iiit.ac.in") ? "iiit" : "non-iiit";


      // Derive first/last name
      let fName = firstName;
      let lName = lastName;
      if (!fName && name) {
        const parts = name.trim().split(/\s+/);
        fName = parts[0];
        lName = parts.slice(1).join(" ") || "";
      }

      // Create user (handle possible race / duplicate)
      let user;
      try {
        // Let the User model pre-save hook hash the password
        user = await User.create({
          firstName: fName,
          lastName: lName,
          email,
          password,
          role: "participant",
          participantType,
        });
      } catch (createErr) {
        if (createErr && createErr.code === 11000) {
          return res.status(409).json({ message: "User already exists" });
        }
        throw createErr;
      }

      // Generate JWT
      const token = jwt.sign(
        {
          userId: user._id,
          role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.status(201).json({
        token,
        role: user.role,
        userId: user._id,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/*
POST /api/auth/login
Works for all roles
*/
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.debug(`Auth: login attempt failed - user not found for email=${email}`);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (user.isActive === false) {
      console.debug(`Auth: login attempt for disabled account email=${email}`);
      return res.status(403).json({ message: "Account disabled. Contact an administrator." });
    }

    // Detect likely client-side hashing mistakes: bcrypt hashes start with $2a, $2b, $2y etc.
    if (typeof password === "string" && password.startsWith("$2")) {
      console.debug(`Auth: client-sent password appears hashed for email=${email}`);
      return res.status(400).json({ message: "Do not hash the password on the client. Send the raw password string (e.g. '6b4b9f72b8bb')." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.debug(`Auth: password compare failed for userId=${user._id} email=${email}`);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      role: user.role,
      userId: user._id,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

/*
POST /api/auth/logout
Stateless – client deletes token
*/
router.post("/logout", (req, res) => {
  return res.status(200).json({ message: "Logged out successfully" });
});

module.exports = router;