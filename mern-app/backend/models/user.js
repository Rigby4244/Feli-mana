// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["participant", "organizer", "admin"],
      default: "participant",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    participantType: {
      type: String,
      enum: ["iiit", "non-iiit"],
    },
    college: {
      type: String,
    },
    contactNumber: {
      type: String,
    },
    interests: [
      {
        type: String,
        trim: true,
      },
    ],
    followedOrganizers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Organizer",
      },
    ],
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model("User", userSchema);
