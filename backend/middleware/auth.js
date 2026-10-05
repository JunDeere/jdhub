const jwt = require("jsonwebtoken");
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

    const user = await User.findById(payload.userId).select("status").lean();

    if (!user) {
      return res.status(401).json({ error: "Account not found" });
    }

    if (user.status === "disabled") {
      return res.status(403).json({
        error: "This account has been disabled",
      });
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
