const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    status: {
      type: String,
      default: "registered",
      index: true,
    },
    ticketId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    qrCode: {
      type: String,
    },
    paymentProof: {
      type: String,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "pending_review", "paid", "rejected"], 
      default: "pending",
      index: true,
    },
    formResponses: {
      type: mongoose.Schema.Types.Mixed,
    },
    attendedAt: Date,
    auditLog: [
      {
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        action: String,
        note: String,
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Prevent duplicate registration
registrationSchema.index({ userId: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model("Registration", registrationSchema);
