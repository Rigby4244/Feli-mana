const express = require("express");
const Organizer = require("../models/organiser");
const Event = require("../models/event");
const Registration = require("../models/registration");
const PasswordResetRequest = require("../models/passwordresetrequest");
const { protect, requireRole } = require("../middleware/authmiddleware");

const router = express.Router();

/*
All routes protected
*/
router.use(protect, requireRole("organizer"));

/*
GET /api/organizer/profile
View organizer profile
*/
router.get("/profile", async (req, res) => {
  try {
    // Try to find an Organizer document linked to this user. The schema
    // stores the admin who created an organizer in `createdBy`. Some apps
    // map organizer users differently; fall back to returning the user
    // profile if no Organizer document is found.
    let organizer = await Organizer.findOne({ createdBy: req.user._id }).select("name category description contactEmail isActive");

    if (!organizer) {
      // return basic user profile for the organizer account
      const { _id, firstName, lastName, email, contactNumber } = req.user;
      return res.json({ _id, firstName, lastName, email, contactNumber });
    }

    res.json(organizer);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/*
PUT /api/organizer/profile
Profile changes must be done by admin
*/
router.put("/profile", async (req, res) => {
  return res.status(403).json({
    message: "Profile updates must be requested through admin",
  });
});

/*
GET /api/organizer/events
List own events
*/
router.get("/events", async (req, res) => {
  try {
    // Events link to an organizer via `organizerId`. Depending on how the
    // app was used, `organizerId` might be the organizer user _id or an
    // Organizer document id. We support both.
    const events = await Event.find({ $or: [{ organizerId: req.user._id }, { organizerId: await getOrganizerIdForUser(req.user._id) }] });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/*
GET /api/organizer/events/:id
Event detail + analytics
*/
router.get("/events/:id", async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      $or: [{ organizerId: req.user._id }, { organizerId: await getOrganizerIdForUser(req.user._id) }],
    });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const registrations = await Registration.find({ eventId: event._id }).populate("userId");

    const totalRegistrations = registrations.length;
    const paidRegistrations = registrations.filter((r) => r.paymentStatus === "paid");
    const totalRevenue = (event.fee || 0) * paidRegistrations.length;

    res.json({
      event,
      analytics: {
        totalRegistrations,
        paidRegistrations: paidRegistrations.length,
        totalRevenue,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/*
GET /api/organizer/events/:id/registrations
Supports ?search= and ?export=csv
*/
router.get("/events/:id/registrations", async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, $or: [{ organizerId: req.user._id }, { organizerId: await getOrganizerIdForUser(req.user._id) }] });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    let registrations = await Registration.find({ eventId: event._id }).populate("userId");

    // If search provided, filter in-memory on populated user fields
    if (req.query.search) {
      const re = new RegExp(req.query.search, "i");
      registrations = registrations.filter((r) => {
        const user = r.userId || {};
        return re.test(user.firstName || "") || re.test(user.lastName || "") || re.test(user.email || "");
      });
    }

    /*
    CSV Export
    */
    if (req.query.export === "csv") {
      let csv = `Event: ${event.name}\n`;
      csv += `Price: ${event.fee || 0}\n\n`;
      csv += "Name,Email,Status,PaymentStatus\n";

      registrations.forEach((r) => {
        const user = r.userId || {};
        const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
        csv += `${name},${user.email || ""},${r.status || ""},${r.paymentStatus || ""}\n`;
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${event.title}-registrations.csv`
      );

      return res.send(csv);
    }

    res.json({ event, registrations });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// helper: try to find an Organizer doc id linked to this user (if any)
async function getOrganizerIdForUser(userId) {
  try {
    const org = await Organizer.findOne({ createdBy: userId }).select("_id");
    return org ? org._id : null;
  } catch (e) {
    return null;
  }
}

/*
POST /api/organizer/password-reset-request
Submit reset request to admin
*/
router.post("/password-reset-request", async (req, res) => {
  try {
    const { reason } = req.body;

    // We must find the Organizer document associated with this user
    const organizer = await Organizer.findOne({ createdBy: req.user._id });
    
    if (!organizer) {
      return res.status(404).json({ message: "Organizer profile not found for this user." });
    }

    const request = await PasswordResetRequest.create({
      organizerId: organizer._id, // Fixed: passing the correct required field
      reason,
      status: "pending",
    });

    res.status(201).json({
      message: "Password reset request sent to admin",
      request,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;