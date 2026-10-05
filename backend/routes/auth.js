const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const LoginChallenge = require("../models/LoginChallenge");
const TrustedBrowser = require("../models/TrustedBrowser");
const authMiddleware = require("../middleware/auth");
const { resetDemoData } = require("../services/demoAccount");
const {
  ensureUserRole,
  normalizeEmail,
  roleForEmail,
} = require("../services/siteRoles");
const {
  emailAuthEnabled,
  sendLoginCode,
} = require("../services/securityEmail");
const {
  parseCookies,
  recordSecurityEvent,
  requestContext,
  tokenHash,
} = require("../services/securityAudit");

const router = express.Router();
const TRUSTED_BROWSER_COOKIE = "jdhub_trusted_browser";
const TRUSTED_BROWSER_DAYS = Number(process.env.TRUSTED_BROWSER_DAYS || 30);

function createToken(user) {
  return jwt.sign(
    { userId: user._id, isDemo: Boolean(user.is_demo) },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    },
  );
}

function serializeUser(user) {
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role || roleForEmail(user.email),
    isDemo: Boolean(user.is_demo),
  };
}

function maskEmail(email) {
  const [name, domain] = String(email).split("@");
  const visibleName =
    name.length <= 2
      ? name[0]
      : `${name.slice(0, 2)}${"*".repeat(Math.min(6, name.length - 2))}`;
  return `${visibleName}@${domain}`;
}

function trustedBrowserCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_ENV === "production",
    maxAge: TRUSTED_BROWSER_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

async function findTrustedBrowser(req, userId) {
  const browserToken = parseCookies(req)[TRUSTED_BROWSER_COOKIE];
  if (!browserToken) return null;

  return TrustedBrowser.findOne({
    user_id: userId,
    token_hash: tokenHash(browserToken),
    revoked_at: { $exists: false },
    expires_at: { $gt: new Date() },
  });
}

async function beginEmailChallenge(req, user) {
  const context = requestContext(req);
  const challengeId = crypto.randomUUID();
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const challenge = await LoginChallenge.create({
    challenge_id: challengeId,
    user_id: user._id,
    code_hash: await bcrypt.hash(code, 10),
    expires_at: new Date(Date.now() + 10 * 60 * 1000),
    request_ip: context.ip,
    user_agent: context.user_agent,
  });

  try {
    await sendLoginCode({
      email: user.email,
      code,
      ip: context.ip,
      userAgent: context.user_agent,
    });
  } catch (error) {
    await LoginChallenge.deleteOne({ _id: challenge._id });
    throw error;
  }

  await recordSecurityEvent(req, {
    user_id: user._id,
    email: user.email,
    type: "email_challenge_sent",
    outcome: "pending",
    detail: "A sign-in code was sent for an unrecognized browser.",
  });

  return {
    verificationRequired: true,
    challengeId,
    maskedEmail: maskEmail(user.email),
    expiresAt: challenge.expires_at,
  };
}

async function completeLogin(req, user, detail) {
  if (user.is_demo) await resetDemoData(user._id);

  user.last_login_at = new Date();
  await user.save();

  await recordSecurityEvent(req, {
    user_id: user._id,
    email: user.email,
    type: "login_success",
    outcome: "success",
    detail,
  });

  return {
    token: createToken(user),
    user: serializeUser(user),
  };
}

router.post("/register", async (req, res) => {
  if (process.env.ALLOW_REGISTRATION !== "true") {
    return res.status(403).json({ error: "Account registration is disabled" });
  }

  try {
    const { email, password, name } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });
    const normalizedEmail = normalizeEmail(email);

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(400).json({ error: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: normalizedEmail,
      password_hash: hashed,
      name,
      role: roleForEmail(normalizedEmail),
    });
    if (emailAuthEnabled() && !user.is_demo) {
      return res.json(await beginEmailChallenge(req, user));
    }

    return res.json(
      await completeLogin(req, user, "Account created and signed in."),
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      await recordSecurityEvent(req, {
        email: normalizedEmail,
        type: "login_failure",
        outcome: "failure",
        detail: "Invalid credentials.",
      });
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const legacyUser = await User.collection.findOne({ _id: user._id });
    const storedPasswordHash = user.password_hash || legacyUser?.password;
    const valid =
      storedPasswordHash &&
      (await bcrypt.compare(password, storedPasswordHash));
    if (!valid) {
      await recordSecurityEvent(req, {
        user_id: user._id,
        email: user.email,
        type: "login_failure",
        outcome: "failure",
        detail: "Invalid credentials.",
      });
      return res.status(400).json({ error: "Invalid credentials" });
    }

    if (user.status === "disabled") {
      await recordSecurityEvent(req, {
        user_id: user._id,
        email: user.email,
        type: "login_failure",
        outcome: "failure",
        detail: "Sign-in attempted for a disabled account.",
      });

      return res.status(403).json({
        error: "This account has been disabled",
      });
    }

    if (!user.password_hash && legacyUser?.password) {
      user.password_hash = legacyUser.password;
      await user.save();
      await User.collection.updateOne(
        { _id: user._id },
        { $unset: { password: "" } },
      );
    }

    await ensureUserRole(user);
    if (emailAuthEnabled() && !user.is_demo) {
      const trustedBrowser = await findTrustedBrowser(req, user._id);
      if (!trustedBrowser)
        return res.json(await beginEmailChallenge(req, user));

      const context = requestContext(req);
      trustedBrowser.last_ip = context.ip;
      trustedBrowser.last_seen_at = new Date();
      trustedBrowser.expires_at = new Date(
        Date.now() + TRUSTED_BROWSER_DAYS * 24 * 60 * 60 * 1000,
      );
      await trustedBrowser.save();
      return res.json(
        await completeLogin(req, user, "Signed in from a trusted browser."),
      );
    }

    return res.json(
      await completeLogin(
        req,
        user,
        user.is_demo
          ? "Demo account signed in."
          : "Password sign-in completed.",
      ),
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/verify-email", async (req, res) => {
  try {
    const { challengeId, code, trustBrowser = true } = req.body;
    if (!challengeId || !/^\d{6}$/.test(String(code || ""))) {
      return res
        .status(400)
        .json({ error: "Enter the six-digit code from your email" });
    }

    const challenge = await LoginChallenge.findOne({
      challenge_id: challengeId,
    }).populate("user_id");
    if (!challenge || challenge.used_at || challenge.expires_at <= new Date()) {
      return res
        .status(400)
        .json({ error: "This sign-in code has expired. Start again." });
    }
    if (challenge.attempts >= 5) {
      return res
        .status(429)
        .json({ error: "Too many incorrect attempts. Start again." });
    }

    const valid = await bcrypt.compare(String(code), challenge.code_hash);
    if (!valid) {
      challenge.attempts += 1;
      await challenge.save();
      await recordSecurityEvent(req, {
        user_id: challenge.user_id._id,
        email: challenge.user_id.email,
        type: "email_challenge_failed",
        outcome: "failure",
        detail: "An incorrect sign-in code was submitted.",
      });
      return res.status(400).json({ error: "Incorrect sign-in code" });
    }

    if (challenge.user_id.status === "disabled") {
      return res.status(403).json({
        error: "This account has been disabled",
      });
    }

    challenge.used_at = new Date();
    await challenge.save();

    if (trustBrowser) {
      const rawBrowserToken = crypto.randomBytes(32).toString("base64url");
      const context = requestContext(req);
      await TrustedBrowser.create({
        user_id: challenge.user_id._id,
        token_hash: tokenHash(rawBrowserToken),
        label: context.user_agent.slice(0, 100),
        user_agent: context.user_agent,
        first_ip: context.ip,
        last_ip: context.ip,
        expires_at: new Date(
          Date.now() + TRUSTED_BROWSER_DAYS * 24 * 60 * 60 * 1000,
        ),
      });
      res.cookie(
        TRUSTED_BROWSER_COOKIE,
        rawBrowserToken,
        trustedBrowserCookieOptions(),
      );
    }

    return res.json(
      await completeLogin(
        req,
        challenge.user_id,
        "Email verification completed.",
      ),
    );
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    await ensureUserRole(user);

    res.json({ user: serializeUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/me", authMiddleware, async (req, res) => {
  try {
    if (req.isDemo)
      return res
        .status(403)
        .json({ error: "Demo profile changes are disabled" });

    const { name, phone } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.name = typeof name === "string" ? name.trim() : user.name;
    user.phone = typeof phone === "string" ? phone.trim() : user.phone;
    await user.save();

    res.json({ user: serializeUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
