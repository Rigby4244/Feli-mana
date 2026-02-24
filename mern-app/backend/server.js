const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authroutes");
const adminRoutes = require("./routes/adminroutes");
const organizerRoutes = require("./routes/organizerroutes");
const eventRoutes = require("./routes/eventroutes");
const registrationRoutes = require("./routes/registrationroutes");
const attendanceRoutes = require("./routes/attendanceroutes");
const forumRoutes = require("./routes/forumroutes");
const feedbackRoutes = require("./routes/feedbackroutes");
const organizersRoutes = require("./routes/organizersroutes");
const participantRoutes = require("./routes/participantroutes");

// Load env variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Trust proxy when behind a reverse proxy (Heroku, etc.)
if (process.env.TRUST_PROXY || process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Security and performance middleware
app.use(helmet());
app.use(compression());

// Logging
if (process.env.NODE_ENV === "production") {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

// CORS and body parser
const corsOptions = {
  origin: process.env.FRONTEND_ORIGIN || "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

// Attach routes that don't need socket.io first

// Test route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Health-check for readiness/liveness probes
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
});

// Auth routes
app.use("/api/auth", authRoutes);
// Admin routes
app.use("/api/admin", adminRoutes);
// Organizer routes
app.use("/api/organizer", organizerRoutes);
// Event routes
app.use("/api/events", eventRoutes);
// Registration routes
app.use("/api/registrations", registrationRoutes);

// Attendance and forum routes
app.use("/api/attendance", attendanceRoutes);
app.use("/api/forum", forumRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/organizers", organizersRoutes);
app.use("/api/participants", participantRoutes);

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
});

// Make io available to routes via app.get('io')
app.set("io", io);

io.on("connection", (socket) => {
  socket.on("join:event", ({ eventId }) => {
    if (eventId) socket.join(String(eventId));
  });

  socket.on("leave:event", ({ eventId }) => {
    if (eventId) socket.leave(String(eventId));
  });

  // When a client sends forum:send, broadcast it to the room
  socket.on("forum:send", (payload) => {
    try {
      if (payload && payload.eventId) {
        io.to(String(payload.eventId)).emit("forum:message", payload.message || payload);
      }
    } catch (err) {
      console.error("Error broadcasting forum:send", err);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});