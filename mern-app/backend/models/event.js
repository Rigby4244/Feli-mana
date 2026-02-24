const mongoose = require("mongoose");

const customFieldSchema = new mongoose.Schema(
  {
    label: String,
    type: { type: String }, // text, select, checkbox, file etc
    required: Boolean,
    options: [String], // for select/dropdown
  },
  { _id: false }
);

const variantSchema = new mongoose.Schema(
  {
    name: String,
    price: Number,
    stock: Number,
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      index: true,
    },
    description: String,
    type: {
      type: String,
      enum: ["normal", "merchandise"],
      default: "normal",
      index: true,
    },
    eligibility: String,
    registrationDeadline: Date,
    startDate: Date,
    endDate: Date,
    registrationLimit: Number,
    fee: {
      type: Number,
      default: 0,
    },
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organizer",
      required: true,
      index: true,
    },
    tags: [
      {
        type: String,
        index: true,
      },
    ],
    status: {
      type: String,
      enum: ["draft", "published", "ongoing", "completed", "closed"],
      default: "draft",
      index: true,
    },
    customForm: [customFieldSchema],
    merchandiseDetails: {
      variants: [variantSchema],
      stockQuantity: Number,
      purchaseLimitPerUser: Number,
    },
  },
  { timestamps: true }
);

// Compound index for efficient filtering
eventSchema.index({ status: 1, startDate: 1 });
eventSchema.index({ organizerId: 1, status: 1 });

module.exports = mongoose.model("Event", eventSchema);
