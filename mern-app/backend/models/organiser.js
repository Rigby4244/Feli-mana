const mongoose = require("mongoose");

const organizerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    contactEmail: {
      type: String,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // admin user
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    discordWebhook: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Organizer", organizerSchema);
