const express = require("express");
const { v4: uuidv4 } = require("uuid");
const QRCode = require("qrcode");
const multer = require("multer");

const Event = require("../models/event");
const Registration = require("../models/registration");
const User = require("../models/user");
const { protect, requireRole } = require("../middleware/authmiddleware");
const sendEmail = require("../config/mailer");

const router = express.Router();

/* ---------- MULTER SETUP ---------- */

const storage = multer.memoryStorage();
const upload = multer({ storage });

/* =====================================================
POST /api/registrations
Participant registers
===================================================== */
router.post("/", protect, requireRole("participant"), async (req, res) => {
  try {
    const { eventId } = req.body;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    // Deadline validation
    if (new Date() > new Date(event.registrationDeadline)) {
      return res.status(400).json({ message: "Registration deadline passed" });
    }

    // Limit validation
    const count = await Registration.countDocuments({ eventId });
    if (event.registrationLimit && count >= event.registrationLimit) {
      return res.status(400).json({ message: "Registration limit exceeded" });
    }

    // Duplicate validation
    const existing = await Registration.findOne({
      userId: req.user._id,
      eventId,
    });

    if (existing) {
      return res.status(400).json({ message: "Already registered" });
    }

    const ticketId = uuidv4();

    // Merchandise event logic
    if (event.type === "merchandise") {
      // Check nested merchandiseDetails object
      if (!event.merchandiseDetails || event.merchandiseDetails.stockQuantity <= 0) {
        return res.status(400).json({ message: "Out of stock" });
      }

      // Decrement the correct field
      event.merchandiseDetails.stockQuantity -= 1;
      await event.save();

      const registration = await Registration.create({
        userId: req.user._id,
        eventId,
        ticketId,
        paymentStatus: "pending",
      });

      return res.status(201).json(registration);
    }

    // Normal event
    const qrCode = await QRCode.toDataURL(ticketId);

    const registration = await Registration.create({
      userId: req.user._id,
      eventId,
      ticketId,
      qrCode,
      paymentStatus: event.fee > 0 ? "pending" : "paid",
    });

    // Send email
    await sendEmail({
      from: process.env.EMAIL_USER,
      to: req.user.email,
      subject: "Event Registration Confirmed",
      html: `<h3>Your Ticket ID: ${ticketId}</h3>
             <img src="${qrCode}" />`,
    });

    res.status(201).json(registration);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
Upload Payment Proof
===================================================== */
router.post(
  "/:id/payment-proof",
  protect,
  requireRole("participant"),
  upload.single("paymentProof"),
  async (req, res) => {
    try {
      const registration = await Registration.findById(req.params.id);

      if (!registration)
        return res.status(404).json({ message: "Not found" });

      if (registration.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      registration.paymentProof = req.file.buffer.toString("base64");
      registration.paymentStatus = "pending_review";

      await registration.save();

      res.json({ message: "Payment proof uploaded" });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

/* =====================================================
Organizer approves/rejects payment
===================================================== */
router.patch(
  "/:id/payment-status",
  protect,
  requireRole("organizer"),
  async (req, res) => {
    try {
      const { status } = req.body; // approved or rejected

      const registration = await Registration.findById(req.params.id);
      if (!registration)
        return res.status(404).json({ message: "Not found" });

      const event = await Event.findById(registration.eventId);
      // Allow ownership if event.organizerId equals organizer user id OR
      // the organizer document references this user as its creator.
      const isUserOwner = event.organizerId && event.organizerId.toString() === req.user._id.toString();
      let orgDoc = null;
      if (!isUserOwner) orgDoc = await require("../models/organiser").findOne({ _id: event.organizerId, createdBy: req.user._id });
      if (!isUserOwner && !orgDoc) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      if (status === "approved") {
        registration.paymentStatus = "paid";

        const qrCode = await QRCode.toDataURL(registration.ticketId);
        registration.qrCode = qrCode;

        const registrant = await User.findById(registration.userId);
        if (registrant) {
          await sendEmail({
            from: process.env.EMAIL_USER,
            to: registrant.email,
            subject: "Payment Approved",
            html: `<h3>Your registration is approved</h3>
                   <img src="${qrCode}" />`,
          });
        }
      }

      if (status === "rejected") {
        registration.paymentStatus = "rejected";

        const registrant = await User.findById(registration.userId);
        if (registrant) {
          await sendEmail({
            from: process.env.EMAIL_USER,
            to: registrant.email,
            subject: "Payment Rejected",
            html: `<h3>Your payment was rejected.</h3>`,
          });
        }
      }

      await registration.save();
      res.json(registration);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

/* =====================================================
GET /api/registrations/my
Participant registrations grouped by status
===================================================== */
router.get(
  "/my",
  protect,
  requireRole("participant"),
  async (req, res) => {
    try {
      const registrations = await Registration.find({
        userId: req.user._id,
      }).populate("eventId");

      const grouped = {
        pending: [],
        pending_review: [],
        paid: [],
        rejected: [],
      };

      registrations.forEach((r) => {
        grouped[r.paymentStatus]?.push(r);
      });

      res.json(grouped);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;