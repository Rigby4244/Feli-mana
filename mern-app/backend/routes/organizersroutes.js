const express = require("express");
const Organizer = require("../models/organiser");
const Event = require("../models/event");

const router = express.Router();

// GET /api/organizers - public list of active organizers
router.get("/", async (req, res) => {
  try {
    const organizers = await Organizer.find({ isActive: true }).select("name category description contactEmail");
    res.json({ organizers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/organizers/:id - organizer detail with upcoming/past events
router.get("/:id", async (req, res) => {
  try {
    const organizer = await Organizer.findById(req.params.id).select("name category description contactEmail");
    if (!organizer) return res.status(404).json({ message: "Organizer not found" });

    const now = new Date();
    const upcoming = await Event.find({ organizerId: organizer._id, startDate: { $gte: now }, status: { $ne: "draft" } }).sort({ startDate: 1 });
    const past = await Event.find({ organizerId: organizer._id, endDate: { $lt: now } }).sort({ startDate: -1 });

    res.json({ organizer, upcoming, past });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
