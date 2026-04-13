import crypto from "crypto";
import { q } from "./db.js";

// ─── Session Management ─────────────────────────────────────────────────────

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  q.run("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", [token, userId, expiresAt]);
  return { token, expiresAt };
}

export function getSession(token) {
  return q.get("SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')", [token]);
}

export function deleteSession(token) {
  q.run("DELETE FROM sessions WHERE token = ?", [token]);
}

// ─── Auth Middleware ─────────────────────────────────────────────────────────

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const token = authHeader.slice(7);
  const session = getSession(token);
  if (!session) {
    return res.status(401).json({ error: "Session expired" });
  }
  const user = q.get("SELECT * FROM users WHERE id = ?", [session.user_id]);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }
  req.user = user;
  req.sessionToken = token;
  next();
}

export function adminMiddleware(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// ─── Twitter OAuth 2.0 PKCE Helpers ─────────────────────────────────────────

const pendingStates = new Map();

export function generateCodeVerifier() {
  return crypto.randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function generateState() {
  return crypto.randomBytes(16).toString("hex");
}

export function storeOAuthState(state, codeVerifier) {
  pendingStates.set(state, { codeVerifier, createdAt: Date.now() });
  for (const [k, v] of pendingStates) {
    if (Date.now() - v.createdAt > 600000) pendingStates.delete(k);
  }
}

export function getOAuthState(state) {
  const entry = pendingStates.get(state);
  if (entry) pendingStates.delete(state);
  return entry || null;
}

// ─── Admin Check ────────────────────────────────────────────────────────────

export function isAdminHandle(handle) {
  const admins = (process.env.ADMIN_TWITTER_HANDLES || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(handle.toLowerCase());
}
