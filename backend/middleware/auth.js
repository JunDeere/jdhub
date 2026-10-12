const jwt = require("jsonwebtoken");
const AuthSession = require("../models/AuthSession");
const User = require("../models/User");

function readToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

async function auth(req, res, next) {
  const token = readToken(req);

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (payload.purpose) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const user = await User.findById(payload.userId).select("status session_version").lean();

    if (!user) {
      return res.status(401).json({ error: "Account not found" });
    }

    if (user.status === "disabled") {
      return res.status(403).json({
        error: "This account has been disabled",
      });
    }

    if (Number(payload.sessionVersion || 0) !== Number(user.session_version || 0)) {
      return res.status(401).json({ error: "Session revoked" });
    }

    if (payload.jti) {
      const session = await AuthSession.findOne({
        jti: payload.jti,
        user_id: payload.userId,
        revoked_at: { $exists: false },
        expires_at: { $gt: new Date() },
      }).lean();
      if (!session) return res.status(401).json({ error: "Session revoked" });
      req.sessionId = session._id;
      req.sessionJti = payload.jti;
      if (!session.last_seen_at || Date.now() - new Date(session.last_seen_at).getTime() > 5 * 60 * 1000) {
        AuthSession.updateOne(
          { _id: session._id },
          {
            $set: {
              last_seen_at: new Date(),
              ip: String(req.ip || req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, ''),
            },
          },
        ).catch(() => {});
      }
    }

    req.userId = payload.userId;
    req.isDemo = Boolean(payload.isDemo);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

auth.notepadBridge = async function notepadBridge(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.purpose !== "notepad_bridge" || !payload.userId) {
      return res.status(401).json({ error: "Invalid bridge token" });
    }

    const user = await User.findById(payload.userId).select("status").lean();
    if (!user) return res.status(401).json({ error: "Account not found" });
    if (user.status === "disabled") {
      return res.status(403).json({ error: "This account has been disabled" });
    }

    req.userId = payload.userId;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid bridge token" });
  }
};

module.exports = auth;
