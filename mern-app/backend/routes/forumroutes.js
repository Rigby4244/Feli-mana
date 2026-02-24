const express = require("express");
const ForumMessage = require("../models/forummessage");
const Registration = require("../models/registration");
const Event = require("../models/event");
const Organizer = require("../models/organiser");
const { protect, requireRole } = require("../middleware/authmiddleware");

const router = express.Router();

// Public read for messages, but we will require authentication for posting
router.get("/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;

    const messages = await ForumMessage.find({ eventId })
      .sort({ isPinned: -1, createdAt: -1 })
      .populate("userId", "firstName lastName");

    res.json({ messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Post a message: only registered participants or organizer
router.post("/:eventId", protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { message, isAnnouncement } = req.body;

    if (!message) return res.status(400).json({ message: "message required" });

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

      // Check if user is organizer for this event. Support both mappings:
      // - event.organizerId may be the organizer user id
      // - or it may reference an Organizer document (which has createdBy)
      const isUserOwner = req.user && event.organizerId && event.organizerId.toString() === req.user._id.toString();
      let orgDoc = null;
      if (req.user && !isUserOwner) orgDoc = await Organizer.findOne({ _id: event.organizerId, createdBy: req.user._id });

      // Or check registration
      const isRegistered = req.user ? await Registration.exists({ eventId, userId: req.user._id }) : false;

      if (!isUserOwner && !orgDoc && !isRegistered) {
        return res.status(403).json({ message: "Forbidden: must be registered or organizer" });
      }

    const newMsg = await ForumMessage.create({ eventId, userId: req.user._id, message, isAnnouncement: !!isAnnouncement });

    // Emit to socket.io room if available
    try {
      const io = req.app.get("io");
      if (io) io.to(String(eventId)).emit("forum:message", newMsg);
    } catch (e) {
      console.warn("Socket emit failed", e);
    }

    res.status(201).json({ message: newMsg });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE a message: organizer only
router.delete("/:eventId/:messageId", protect, requireRole("organizer"), async (req, res) => {
  try {
    const { eventId, messageId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

      const isUserOwner = event.organizerId && event.organizerId.toString() === req.user._id.toString();
      const orgDoc = isUserOwner ? null : await Organizer.findOne({ _id: event.organizerId, createdBy: req.user._id });
      if (!isUserOwner && !orgDoc) return res.status(403).json({ message: "Forbidden: not event organizer" });

    const msg = await ForumMessage.findOneAndDelete({ _id: messageId, eventId });
    if (!msg) return res.status(404).json({ message: "Message not found" });

    // Emit delete
    try {
      const io = req.app.get("io");
      if (io) io.to(String(eventId)).emit("forum:delete", { messageId });
    } catch (e) {
      console.warn("Socket emit failed", e);
    }

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// PIN a message: organizer only
router.patch("/:eventId/:messageId/pin", protect, requireRole("organizer"), async (req, res) => {
  try {
    const { eventId, messageId } = req.params;
    const { pin } = req.body; // boolean

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

      const isUserOwner = event.organizerId && event.organizerId.toString() === req.user._id.toString();
      const orgDoc = isUserOwner ? null : await Organizer.findOne({ _id: event.organizerId, createdBy: req.user._id });
      if (!isUserOwner && !orgDoc) return res.status(403).json({ message: "Forbidden: not event organizer" });

    const msg = await ForumMessage.findOne({ _id: messageId, eventId });
    if (!msg) return res.status(404).json({ message: "Message not found" });

    msg.isPinned = !!pin;
    await msg.save();

    // Emit pin update
    try {
      const io = req.app.get("io");
      if (io) io.to(String(eventId)).emit("forum:pin", { messageId, pinned: msg.isPinned });
    } catch (e) {
      console.warn("Socket emit failed", e);
    }

    res.json({ message: msg });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
