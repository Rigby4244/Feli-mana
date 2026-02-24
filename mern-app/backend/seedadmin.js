require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/user");

const MONGO_URI = process.env.MONGO_URI;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!MONGO_URI) {
  console.error("Missing MONGO_URI in environment");
  process.exit(1);
}

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Please set ADMIN_EMAIL and ADMIN_PASSWORD in the environment");
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => seedAdmin())
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

async function seedAdmin() {
  try {
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      console.log("Admin already exists");
      await mongoose.disconnect();
      process.exit(0);
    }

    const type = ADMIN_EMAIL.endsWith("@iiit.ac.in") ? "iiit" : "non-iiit";

    // Pass plaintext password and let User model pre-save hash it
    await User.create({
      firstName: "Revan",
      lastName: "Pedaballi",
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: "admin",
      participantType: type,
    });

    console.log("Admin created");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err);
    try {
      await mongoose.disconnect();
    } catch (e) {}
    process.exit(1);
  }
}