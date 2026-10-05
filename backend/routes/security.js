const express = require("express");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const SecurityEvent = require("../models/SecurityEvent");
const TrustedBrowser = require("../models/TrustedBrowser");
const TrustedNetwork = require("../models/TrustedNetwork");
const { clientIp, recordSecurityEvent } = require("../services/securityAudit");
const { adminEmail, normalizeEmail } = require("../services/siteRoles");
const router = express.Router();
router.use(auth, requireAdmin);

router.get("/overview", async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [events, browsers, networks, failures24h] = await Promise.all([
      SecurityEvent.find().sort({ createdAt: -1 }).limit(100).lean(),
      TrustedBrowser.find({
        revoked_at: { $exists: false },
        expires_at: { $gt: new Date() },
      })
        .populate("user_id", "email name")
        .sort({ last_seen_at: -1 })
        .lean(),
      TrustedNetwork.find().sort({ createdAt: -1 }).lean(),
      SecurityEvent.countDocuments({
        outcome: "failure",
        createdAt: { $gte: since },
      }),
    ]);
    res.json({
      events,
      browsers,
      networks,
      failures24h,
      currentIp: clientIp(req),
      scope: "JDHub authentication traffic",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/trusted-networks", async (req, res) => {
  try {
    const ip = String(req.body.ip || "").trim();
    if (!ip || ip.length > 64)
      return res.status(400).json({ error: "Enter a valid IP address" });
    const network = await TrustedNetwork.findOneAndUpdate(
      { ip },
      {
        ip,
        label: String(req.body.label || "Trusted network").trim(),
        created_by: req.userId,
      },
      { new: true, upsert: true, runValidators: true },
    );
    res.json({ network });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/trusted-networks/:id", async (req, res) => {
  await TrustedNetwork.deleteOne({ _id: req.params.id });
  res.json({ ok: true });
});

router.patch("/trusted-browsers/:id/revoke", async (req, res) => {
  try {
    const browser = await TrustedBrowser.findByIdAndUpdate(
      req.params.id,
      { revoked_at: new Date() },
      { new: true },
    );
    if (!browser)
      return res.status(404).json({ error: "Trusted browser not found" });
    await recordSecurityEvent(req, {
      user_id: browser.user_id,
      type: "trusted_browser_revoked",
      outcome: "success",
      detail: "Administrator revoked a trusted browser.",
    });
    res.json({ browser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await User.find()
      .select("_id name email role status is_demo createdAt last_login_at")
      .sort({ role: 1, name: 1, email: 1 })
      .lean();

    return res.json({ users });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post("/users", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const name = String(req.body.name || "").trim();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and temporary password are required",
      });
    }

    if (password.length < 12) {
      return res.status(400).json({
        error: "Temporary password must be at least 12 characters",
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({
        error: "An account with that email already exists",
      });
    }

    const user = await User.create({
      email,
      name,
      password_hash: await bcrypt.hash(password, 10),
      role: "member",
      status: "active",
    });

    await recordSecurityEvent(req, {
      user_id: user._id,
      email: user.email,
      type: "account_created",
      outcome: "success",
      detail: "Account created by an administrator.",
    });

    return res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch("/users/:id/status", async (req, res) => {
  try {
    const status = String(req.body.status || "");

    if (!["active", "disabled"].includes(status)) {
      return res.status(400).json({
        error: "Status must be active or disabled",
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    if (String(user._id) === String(req.userId)) {
      return res.status(400).json({
        error: "You cannot disable your own account",
      });
    }

    if (normalizeEmail(user.email) === adminEmail()) {
      return res.status(400).json({
        error: "The primary administrator cannot be disabled",
      });
    }

    user.status = status;
    await user.save();

    if (status === "disabled") {
      await TrustedBrowser.updateMany(
        {
          user_id: user._id,
          revoked_at: { $exists: false },
        },
        {
          $set: { revoked_at: new Date() },
        },
      );
    }

    await recordSecurityEvent(req, {
      user_id: user._id,
      email: user.email,
      type: `account_${status}`,
      outcome: "success",
      detail: `Account ${status} by an administrator.`,
    });

    return res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        is_demo: user.is_demo,
        createdAt: user.createdAt,
        last_login_at: user.last_login_at,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
