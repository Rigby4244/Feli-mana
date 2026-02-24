const express = require("express");
const Feedback = require("../models/feedback");
const Event = require("../models/event");
const Registration = require("../models/registration");
const Organizer = require("../models/organiser");
const { protect, requireRole } = require("../middleware/authmiddleware");

const router = express.Router();

// POST /api/feedback - participant submits feedback (anonymous)
router.post("/", protect, requireRole("participant"), async (req, res) => {
  try {
    const { eventId, rating, comment } = req.body;

    if (!eventId || !rating) return res.status(400).json({ message: "eventId and rating required" });

    if (rating < 1 || rating > 5) return res.status(400).json({ message: "rating must be 1-5" });

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    // Only allow feedback for completed events and if user attended
    const registration = await Registration.findOne({ eventId, userId: req.user._id });
    if (!registration || !registration.attendedAt) {
      return res.status(403).json({ message: "Only attendees of the event can submit feedback" });
    }

    // Ensure event is completed (or ended)
    if (event.endDate && new Date() < new Date(event.endDate)) {
      return res.status(400).json({ message: "Feedback allowed only after event completed" });
    }

    // Upsert feedback per user
    let fb = await Feedback.findOne({ eventId, userId: req.user._id });
    if (!fb) {
      fb = new Feedback({ eventId, userId: req.user._id, rating, comment });
    } else {
      fb.rating = rating;
      fb.comment = comment;
    }

    await fb.save();

    return res.status(201).json({ message: "Feedback submitted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/feedback/:eventId - organizer views aggregated feedback
router.get("/:eventId", protect, requireRole("organizer"), async (req, res) => {
  try {
    const { eventId } = req.params;
    const { minRating } = req.query; // optional filter

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    // Verify organizer owns the event
    const organizer = await Organizer.findOne({ _id: event.organizerId, createdBy: req.user._id });
    if (!organizer) return res.status(403).json({ message: "Forbidden: not event organizer" });

    let query = { eventId };
    if (minRating) query.rating = { $gte: Number(minRating) };

    const feedbacks = await Feedback.find(query).select("rating comment createdAt").sort({ createdAt: -1 });

    const avg = feedbacks.length ? feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length : 0;

    // Do NOT include userId or any identifiers
    const comments = feedbacks.map((f) => ({ rating: f.rating, comment: f.comment, createdAt: f.createdAt }));

    return res.json({ averageRating: avg, count: feedbacks.length, comments });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
