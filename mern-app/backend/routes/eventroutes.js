const express = require("express");
const Event = require("../models/event");
const Registration = require("../models/registration");
const { protect, requireRole } = require("../middleware/authmiddleware");

const router = express.Router();

/*
POST /api/events
Create event (organizer only, starts as draft)
*/
router.post("/", protect, requireRole("organizer"), async (req, res) => {
  try {
    const event = await Event.create({
      ...req.body,
      organizerId: req.user._id,
      status: "draft",
    });

    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/*
PATCH /api/events/:id
Edit with status rules
*/
router.patch("/:id", protect, requireRole("organizer"), async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      organizerId: req.user._id,
    });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const updates = req.body;

    // DRAFT → free edit
    if (event.status === "draft") {
      Object.assign(event, updates);
    }

    // PUBLISHED → limited edit
    else if (event.status === "published") {
      const allowedFields = [
        "description",
        "registrationDeadline",
        "registrationLimit",
        "status",
      ];

      Object.keys(updates).forEach((key) => {
        if (allowedFields.includes(key)) {
          event[key] = updates[key];
        }
      });
    }

    // ONGOING / COMPLETED → only status editable
    else if (event.status === "ongoing" || event.status === "completed") {
      if (updates.status) {
        event.status = updates.status;
      } else {
        return res.status(403).json({
          message:
            "No edits allowed in ongoing/completed state except status change",
        });
      }
    }

    await event.save();
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/*
PATCH /api/events/:id/publish
Draft → Published
*/
router.patch(
  "/:id/publish",
  protect,
  requireRole("organizer"),
  async (req, res) => {
    try {
      const event = await Event.findOne({
        _id: req.params.id,
        organizerId: req.user._id,
      });

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      if (event.status !== "draft") {
        return res.status(400).json({
          message: "Only draft events can be published",
        });
      }

      event.status = "published";
      await event.save();

      res.json({ message: "Event published", event });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

/*
GET /api/events
Public list with filters + trending
*/
router.get("/", async (req, res) => {
  try {
    let query = { status: { $ne: "draft" } };

    // Filters
    if (req.query.type) {
      query.type = req.query.type;
    }

    if (req.query.eligibility) {
      query.eligibility = req.query.eligibility;
    }

    if (req.query.organizerId) {
      query.organizerId = req.query.organizerId;
    }

    if (req.query.dateFrom && req.query.dateTo) {
      query.startDate = {
        $gte: new Date(req.query.dateFrom),
        $lte: new Date(req.query.dateTo),
      };
    }

    // Search on name
    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
      ];
    }

    let events = await Event.find(query);

    /*
    Trending logic:
    Most PAID registrations in last 24h
    */
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const trendingAgg = await Registration.aggregate([
      {
        $match: {
          createdAt: { $gte: last24h },
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: "$eventId",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    const trendingIds = trendingAgg.map((t) => t._id.toString());

    events = events.map((event) => {
      const isTrending = trendingIds.includes(event._id.toString());
      return {
        ...event.toObject(),
        trending: isTrending,
      };
    });

    res.json(events);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/*
GET /api/events/:id
Public event detail
*/
router.get("/:id", async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      status: { $ne: "draft" },
    });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.json(event);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;