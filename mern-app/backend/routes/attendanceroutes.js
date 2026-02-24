const express = require("express");
const Registration = require("../models/registration");
const Event = require("../models/event");
const Organizer = require("../models/organiser");
const User = require("../models/user");
const { protect, requireRole } = require("../middleware/authmiddleware");

const router = express.Router();

// All routes for attendance are organizer-only
router.use(protect, requireRole("organizer"));

// POST /api/attendance/scan
router.post("/scan", async (req, res) => {
  try {
    const { ticketId } = req.body;

    if (!ticketId) return res.status(400).json({ message: "ticketId required" });

    const registration = await Registration.findOne({ ticketId }).populate(
      "userId"
    );

    if (!registration) return res.status(404).json({ message: "Registration not found" });

    // Load event
    const event = await Event.findById(registration.eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    // Verify ownership: event.organizerId may reference the organizer user id
    // directly or an Organizer document. Accept either mapping.
    const isUserOwner = event.organizerId && event.organizerId.toString() === req.user._id.toString();
    let orgDoc = null;
    if (!isUserOwner) {
      orgDoc = await Organizer.findOne({ _id: event.organizerId, createdBy: req.user._id });
    }
    if (!isUserOwner && !orgDoc) {
      return res.status(403).json({ message: "Forbidden: not event organizer" });
    }

    if (registration.attendedAt) {
      return res.status(400).json({ message: "Already scanned", attendedAt: registration.attendedAt });
    }

    registration.attendedAt = new Date();
    registration.auditLog = registration.auditLog || [];
    registration.auditLog.push({ by: req.user._id, action: "scan", note: "scanned at gate", at: new Date() });

    await registration.save();

    const participant = await User.findById(registration.userId).select("firstName lastName email contactNumber");

    return res.json({ registration, participant });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/attendance/:eventId
router.get("/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const isUserOwner = event.organizerId && event.organizerId.toString() === req.user._id.toString();
    let orgDoc = null;
    if (!isUserOwner) {
      orgDoc = await Organizer.findOne({ _id: event.organizerId, createdBy: req.user._id });
    }
    if (!isUserOwner && !orgDoc) return res.status(403).json({ message: "Forbidden: not event organizer" });

    const registrations = await Registration.find({ eventId }).populate("userId");

    const results = registrations.map((r) => ({
      registrationId: r._id,
      user: r.userId,
      attendedAt: r.attendedAt || null,
      ticketId: r.ticketId || null,
      status: r.status,
    }));

    return res.json({ eventId, count: results.length, registrations: results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/attendance/:registrationId/manual
router.patch("/:registrationId/manual", async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { present, note } = req.body; // present: true/false

    const registration = await Registration.findById(registrationId);
    if (!registration) return res.status(404).json({ message: "Registration not found" });

    const event = await Event.findById(registration.eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const isUserOwner = event.organizerId && event.organizerId.toString() === req.user._id.toString();
    let orgDoc = null;
    if (!isUserOwner) {
      orgDoc = await Organizer.findOne({ _id: event.organizerId, createdBy: req.user._id });
    }
    if (!isUserOwner && !orgDoc) return res.status(403).json({ message: "Forbidden: not event organizer" });

    if (present) {
      registration.attendedAt = new Date();
      registration.auditLog = registration.auditLog || [];
      registration.auditLog.push({ by: req.user._id, action: "manual-present", note: note || "manually marked present", at: new Date() });
    } else {
      registration.auditLog = registration.auditLog || [];
      registration.auditLog.push({ by: req.user._id, action: "manual-absent", note: note || "manually marked absent", at: new Date() });
      registration.attendedAt = null;
    }

    await registration.save();

    return res.json({ registration });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
