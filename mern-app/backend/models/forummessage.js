// models/ForumMessage.js
const mongoose = require("mongoose");

const forumMessageSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
    },
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    isAnnouncement: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

forumMessageSchema.index({ eventId: 1, createdAt: -1 });

module.exports = mongoose.model("ForumMessage", forumMessageSchema);
