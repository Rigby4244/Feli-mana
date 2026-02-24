const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Organizer = require("../models/organiser");
const User = require("../models/user");
const PasswordResetRequest = require("../models/passwordresetrequest");
const { protect, requireRole } = require("../middleware/authmiddleware");
const sendEmail = require("../config/mailer");
const { body, validationResult } = require("express-validator");

const router = express.Router();

function generatePassword() {
  return crypto.randomBytes(6).toString("hex");
}

// Create organizer and associated user; return plaintext password once
router.post(
  "/organizers",
  protect,
  requireRole("admin"),
  body("name").notEmpty(),
  body("category").notEmpty(),
  body("contactEmail").isEmail(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, category, description, contactEmail, discordWebhook } =
      req.body;

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      // Ensure user doesn't already exist
      const existingUser = await User.findOne({ email: contactEmail }).session(session);
      if (existingUser) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({ message: "User with that email exists" });
      }

      const plainPassword = generatePassword();

      // Create organizer
      const organizer = await Organizer.create([
        {
          name,
          category,
          description,
          contactEmail,
          discordWebhook,
          createdBy: req.user._id,
        },
      ], { session });

      // Create user account for organizer
      const nameParts = name.trim().split(" ");
      const firstName = nameParts[0] || "Organizer";
      const lastName = nameParts.slice(1).join(" ") || "Org";

      // Create user with plaintext password so model pre-save can hash it
      await User.create([
        {
          firstName,
          lastName,
          email: contactEmail,
          password: plainPassword,
          role: "organizer",
        },
      ], { session });

      await session.commitTransaction();
      session.endSession();

      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        try {
          await sendEmail({
            from: process.env.EMAIL_USER,
            to: contactEmail,
            subject: "Your organizer account",
            text: `Your account has been created. Temporary password: ${plainPassword}`,
          });
        } catch (mailErr) {
          console.error("Email send failed:", mailErr);
        }

        return res.status(201).json({ organizer: organizer[0], message: "Organizer created; password emailed" });
      }

      return res.status(201).json({ organizer: organizer[0], password: plainPassword });
    } catch (err) {
      await session.abortTransaction().catch(() => {});
      session.endSession();
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

// List all organizers
router.get("/organizers", protect, requireRole("admin"), async (req, res) => {
  try {
    const organizers = await Organizer.find().sort({ createdAt: -1 });
    res.json({ organizers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Soft delete organizer (set isActive = false)
router.delete(
  "/organizers/:id",
  protect,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const organizer = await Organizer.findById(id);
      if (!organizer) return res.status(404).json({ message: "Not found" });

      organizer.isActive = false;
      await organizer.save();

      // Disable associated user account (if any)
      try {
        const user = await User.findOne({ email: organizer.contactEmail });
        if (user) {
          user.isActive = false;
          await user.save();
        }
      } catch (e) {
        console.error("Failed to disable user for organizer:", e);
      }

      res.json({ message: "Organizer deactivated" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// List pending password reset requests
router.get(
  "/password-reset-requests",
  protect,
  requireRole("admin"),
  async (req, res) => {
    try {
      const requests = await PasswordResetRequest.find({ status: "pending" })
        .sort({ createdAt: -1 })
        .populate("organizerId");
      res.json({ requests });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Approve or reject password reset request
router.patch(
  "/password-reset-requests/:id",
  protect,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { action, adminComment } = req.body; // action: 'approve' | 'reject'

      const reqDoc = await PasswordResetRequest.findById(id);
      if (!reqDoc) return res.status(404).json({ message: "Not found" });

      if (reqDoc.status !== "pending") {
        return res.status(400).json({ message: "Request already processed" });
      }

      if (action === "reject") {
        reqDoc.status = "rejected";
        reqDoc.adminComment = adminComment || "";
        await reqDoc.save();
        return res.json({ message: "Request rejected" });
      }

      if (action === "approve") {
        // Generate new password and set it for the organizer's user
        const organizer = await Organizer.findById(reqDoc.organizerId);
        if (!organizer) return res.status(404).json({ message: "Organizer not found" });

        const newPassword = generatePassword();

        const user = await User.findOne({ email: organizer.contactEmail });
        if (!user) return res.status(404).json({ message: "User not found" });

        // Assign plaintext so model pre-save hashes it
        user.password = newPassword;
        await user.save();

        reqDoc.status = "approved";
        reqDoc.adminComment = adminComment || "";
        await reqDoc.save();

        // Send email if configured
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
          try {
            await sendEmail({
              from: process.env.EMAIL_USER,
              to: organizer.contactEmail,
              subject: "Your password has been reset",
              text: `Your new temporary password: ${newPassword}`,
            });
          } catch (mailErr) {
            console.error("Email send failed:", mailErr);
          }

          return res.json({ message: "Password reset approved; password emailed to organizer" });
        }

        return res.json({ message: "Password reset approved", password: newPassword });
      }

      return res.status(400).json({ message: "Invalid action" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
