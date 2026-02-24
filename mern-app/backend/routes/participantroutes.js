const express = require("express");
const User = require("../models/user");
const Organizer = require("../models/organiser");
const bcrypt = require("bcryptjs");
const { protect, requireRole } = require("../middleware/authmiddleware");

const router = express.Router();

// PATCH /api/participants/preferences - update interests and followedOrganizers
router.patch("/preferences", protect, requireRole("participant"), async (req, res) => {
  try {
    const { interests, followedOrganizers } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (interests) user.interests = Array.isArray(interests) ? interests : user.interests;

    if (followedOrganizers) {
      // Validate organizers
      const valid = await Organizer.find({ _id: { $in: followedOrganizers }, isActive: true }).select("_id");
      user.followedOrganizers = valid.map((o) => o._id);
    }

    await user.save();
    res.json({ message: "Preferences updated", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/participants/profile - update editable participant fields
router.put("/profile", protect, requireRole("participant"), async (req, res) => {
  try {
    const { firstName, lastName, contactNumber, college, participantType } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (contactNumber) user.contactNumber = contactNumber;
    if (college) user.college = college;
    if (participantType) user.participantType = participantType;

    await user.save();
    res.json({ message: "Profile updated", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/participants/change-password - verify current password, update
router.put("/change-password", protect, requireRole("participant"), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: "currentPassword and newPassword required" });

    const user = await User.findById(req.user._id).select("password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ message: "Current password is incorrect" });

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
