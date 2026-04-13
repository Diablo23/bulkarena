import { Router } from "express";
import fetch from "node-fetch";
import { q } from "./db.js";
import {
  authMiddleware,
  adminMiddleware,
  createSession,
  deleteSession,
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  storeOAuthState,
  getOAuthState,
  isAdminHandle,
} from "./auth.js";
import { fetchFullAccount } from "./bulk-api.js";

const router = Router();

// ═════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═════════════════════════════════════════════════════════════════════════════

router.get("/auth/twitter", (req, res) => {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const callbackUrl = process.env.TWITTER_CALLBACK_URL;

  if (!clientId || !callbackUrl) {
    return res.status(500).json({ error: "Twitter OAuth not configured" });
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  storeOAuthState(state, codeVerifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: "tweet.read users.read offline.access",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  res.json({ url: `https://twitter.com/i/oauth2/authorize?${params}` });
});

router.get("/auth/twitter/callback", async (req, res) => {
  const { code, state, error: oauthError } = req.query;
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

  if (oauthError) return res.redirect(`${clientUrl}?error=oauth_denied`);
  if (!code || !state) return res.redirect(`${clientUrl}?error=missing_params`);

  const oauthState = getOAuthState(state);
  if (!oauthState) return res.redirect(`${clientUrl}?error=invalid_state`);

  try {
    // Build auth header - Twitter Web Apps require Basic Auth
    const headers = { "Content-Type": "application/x-www-form-urlencoded" };
    const clientSecret = process.env.TWITTER_CLIENT_SECRET;
    if (clientSecret) {
      const credentials = Buffer.from(`${process.env.TWITTER_CLIENT_ID}:${clientSecret}`).toString("base64");
      headers["Authorization"] = `Basic ${credentials}`;
    }

    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers,
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: process.env.TWITTER_CLIENT_ID,
        redirect_uri: process.env.TWITTER_CALLBACK_URL,
        code_verifier: oauthState.codeVerifier,
      }),
    });

    const tokenData = await tokenRes.json();
    console.log("[Auth] Token response status:", tokenRes.status);
    if (!tokenData.access_token) {
      console.error("[Auth] Token exchange failed:", JSON.stringify(tokenData));
      return res.redirect(`${clientUrl}?error=token_failed`);
    }

    const userRes = await fetch("https://api.twitter.com/2/users/me?user.fields=profile_image_url,username", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userData = await userRes.json();
    if (!userData.data) return res.redirect(`${clientUrl}?error=profile_failed`);

    const { id: twitterId, username, name, profile_image_url } = userData.data;
    const isAdmin = isAdminHandle(username) ? 1 : 0;

    // Upsert user
    const existing = q.get("SELECT * FROM users WHERE twitter_id = ?", [twitterId]);
    if (existing) {
      q.run(
        "UPDATE users SET twitter_handle = ?, twitter_name = ?, twitter_avatar = ?, is_admin = CASE WHEN ? = 1 THEN 1 ELSE is_admin END, updated_at = datetime('now') WHERE twitter_id = ?",
        [username, name, profile_image_url || "", isAdmin, twitterId]
      );
    } else {
      q.run(
        "INSERT INTO users (twitter_id, twitter_handle, twitter_name, twitter_avatar, is_admin) VALUES (?, ?, ?, ?, ?)",
        [twitterId, username, name, profile_image_url || "", isAdmin]
      );
    }

    const user = q.get("SELECT * FROM users WHERE twitter_id = ?", [twitterId]);
    const session = createSession(user.id);

    res.redirect(`${clientUrl}?token=${session.token}`);
  } catch (err) {
    console.error("[Auth] OAuth error:", err);
    res.redirect(`${clientUrl}?error=server_error`);
  }
});

router.get("/auth/me", authMiddleware, (req, res) => {
  const { id, twitter_handle, twitter_name, twitter_avatar, wallet_pubkey, is_admin } = req.user;
  res.json({ id, twitter_handle, twitter_name, twitter_avatar, wallet_pubkey, is_admin: !!is_admin });
});

router.post("/auth/logout", authMiddleware, (req, res) => {
  deleteSession(req.sessionToken);
  res.json({ ok: true });
});

router.put("/auth/wallet", authMiddleware, (req, res) => {
  const { pubkey } = req.body;
  if (!pubkey || pubkey.length < 32 || pubkey.length > 50) {
    return res.status(400).json({ error: "Invalid public key" });
  }
  q.run("UPDATE users SET wallet_pubkey = ?, updated_at = datetime('now') WHERE id = ?", [pubkey, req.user.id]);
  res.json({ ok: true, pubkey });
});

// ═════════════════════════════════════════════════════════════════════════════
// COMPETITION ROUTES
// ═════════════════════════════════════════════════════════════════════════════

router.get("/competitions", (req, res) => {
  const comps = q.all(`
    SELECT c.*, u.twitter_handle as created_by_handle, u.twitter_avatar as created_by_avatar,
      (SELECT COUNT(*) FROM registrations r WHERE r.competition_id = c.id) as trader_count
    FROM competitions c
    LEFT JOIN users u ON c.created_by = u.id
    ORDER BY c.created_at DESC
  `);
  res.json(comps);
});

router.get("/competitions/:id", (req, res) => {
  const comp = q.get(`
    SELECT c.*, u.twitter_handle as created_by_handle,
      (SELECT COUNT(*) FROM registrations r WHERE r.competition_id = c.id) as trader_count
    FROM competitions c
    LEFT JOIN users u ON c.created_by = u.id
    WHERE c.id = ?
  `, [req.params.id]);

  if (!comp) return res.status(404).json({ error: "Competition not found" });
  res.json(comp);
});

router.post("/competitions", authMiddleware, adminMiddleware, (req, res) => {
  const { name, description, start_time, duration_hours, max_traders, start_balance } = req.body;

  if (!name || !start_time || !duration_hours) {
    return res.status(400).json({ error: "name, start_time, and duration_hours are required" });
  }

  const validDurations = [0.25, 3, 5, 10];
  if (!validDurations.includes(Number(duration_hours))) {
    return res.status(400).json({ error: "duration_hours must be 0.25, 3, 5, or 10" });
  }

  const startDate = new Date(start_time);
  if (startDate <= new Date()) {
    return res.status(400).json({ error: "Start time must be in the future" });
  }
  const endDate = new Date(startDate.getTime() + Number(duration_hours) * 3600000);
  const status = "upcoming";

  const result = q.run(
    "INSERT INTO competitions (name, description, start_time, end_time, duration_hours, max_traders, start_balance, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [name, description || "", startDate.toISOString(), endDate.toISOString(), Number(duration_hours), Number(max_traders) || 50, Number(start_balance) || 10000, status, req.user.id]
  );

  res.json({ id: result.lastInsertRowid, status });
});

router.delete("/competitions/:id", authMiddleware, adminMiddleware, (req, res) => {
  q.run("DELETE FROM competitions WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

// ═════════════════════════════════════════════════════════════════════════════
// REGISTRATION ROUTES
// ═════════════════════════════════════════════════════════════════════════════

router.post("/competitions/:id/register", authMiddleware, (req, res) => {
  const { wallet_pubkey } = req.body;
  const pubkey = wallet_pubkey || req.user.wallet_pubkey;

  if (!pubkey || pubkey.length < 32) {
    return res.status(400).json({ error: "Set your wallet public key first" });
  }

  const comp = q.get("SELECT * FROM competitions WHERE id = ?", [req.params.id]);
  if (!comp) return res.status(404).json({ error: "Competition not found" });
  if (comp.status === "ended" || comp.status === "cancelled") {
    return res.status(400).json({ error: "Competition has ended" });
  }

  const existing = q.get("SELECT * FROM registrations WHERE competition_id = ? AND user_id = ?", [comp.id, req.user.id]);
  if (existing) return res.status(400).json({ error: "Already registered" });

  const count = q.get("SELECT COUNT(*) as c FROM registrations WHERE competition_id = ?", [comp.id]);
  if (count.c >= comp.max_traders) {
    return res.status(400).json({ error: "Competition is full" });
  }

  if (wallet_pubkey) {
    q.run("UPDATE users SET wallet_pubkey = ? WHERE id = ?", [wallet_pubkey, req.user.id]);
  }

  q.run("INSERT INTO registrations (competition_id, user_id, wallet_pubkey) VALUES (?, ?, ?)", [comp.id, req.user.id, pubkey]);

  // Take initial snapshot async
  (async () => {
    const account = await fetchFullAccount(pubkey);
    if (account?.margin) {
      const m = account.margin;
      q.run(
        "INSERT INTO snapshots (competition_id, user_id, wallet_pubkey, total_balance, available_balance, margin_used, notional, realized_pnl, unrealized_pnl, fees, funding, positions_json, open_orders_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [comp.id, req.user.id, pubkey, m.totalBalance || 0, m.availableBalance || 0, m.marginUsed || 0, m.notional || 0, m.realizedPnl || 0, m.unrealizedPnl || 0, m.fees || 0, m.funding || 0, JSON.stringify(account.positions || []), (account.openOrders || []).length]
      );
    }
  })();

  res.json({ ok: true });
});

router.delete("/competitions/:id/register", authMiddleware, (req, res) => {
  q.run("DELETE FROM registrations WHERE competition_id = ? AND user_id = ?", [req.params.id, req.user.id]);
  res.json({ ok: true });
});

router.get("/competitions/:id/traders", (req, res) => {
  const traders = q.all(`
    SELECT r.wallet_pubkey, r.registered_at, u.id as user_id, u.twitter_handle, u.twitter_name, u.twitter_avatar
    FROM registrations r
    JOIN users u ON r.user_id = u.id
    WHERE r.competition_id = ?
    ORDER BY r.registered_at ASC
  `, [req.params.id]);
  res.json(traders);
});

// ═════════════════════════════════════════════════════════════════════════════
// LEADERBOARD
// ═════════════════════════════════════════════════════════════════════════════

router.get("/competitions/:id/leaderboard", (req, res) => {
  const comp = q.get("SELECT * FROM competitions WHERE id = ?", [req.params.id]);
  if (!comp) return res.status(404).json({ error: "Competition not found" });

  const traders = q.all(`
    SELECT r.wallet_pubkey, r.registered_at, u.id as user_id, u.twitter_handle, u.twitter_name, u.twitter_avatar
    FROM registrations r
    JOIN users u ON r.user_id = u.id
    WHERE r.competition_id = ?
  `, [req.params.id]);

  const leaderboard = traders.map((t) => {
    const snapshots = q.all(
      "SELECT * FROM snapshots WHERE competition_id = ? AND user_id = ? ORDER BY captured_at ASC",
      [req.params.id, t.user_id]
    );

    const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    const first = snapshots.length > 0 ? snapshots[0] : null;

    const startBalance = first ? first.total_balance : comp.start_balance;
    const currentBalance = latest ? latest.total_balance : startBalance;

    // Competition-relative PnL: subtract the PnL that existed at registration
    const basePnl = (first?.realized_pnl || 0) + (first?.unrealized_pnl || 0);
    const currentPnl = (latest?.realized_pnl || 0) + (latest?.unrealized_pnl || 0);
    const pnl = currentPnl - basePnl;
    const roi = startBalance > 0 ? pnl / startBalance : 0;

    const balances = snapshots.map((s) => s.total_balance);
    let peak = balances[0] || startBalance;
    let maxDD = 0;
    for (const b of balances) {
      if (b > peak) peak = b;
      const dd = peak > 0 ? (b - peak) / peak : 0;
      if (dd < maxDD) maxDD = dd;
    }

    const returns = [];
    for (let i = 1; i < balances.length; i++) {
      if (balances[i - 1] > 0) returns.push((balances[i] - balances[i - 1]) / balances[i - 1]);
    }
    const avgR = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const stdR = returns.length > 1 ? Math.sqrt(returns.reduce((a, r) => a + (r - avgR) ** 2, 0) / (returns.length - 1)) : 0;
    const sharpe = stdR > 0 ? (avgR / stdR) * Math.sqrt(Math.min(returns.length, 48)) : 0;

    let positions = [];
    try { positions = latest?.positions_json ? JSON.parse(latest.positions_json) : []; } catch {}

    const maxLeverage = positions.reduce((m, p) => Math.max(m, p.leverage || 0), 0);

    return {
      user_id: t.user_id,
      twitter_handle: t.twitter_handle,
      twitter_name: t.twitter_name,
      twitter_avatar: t.twitter_avatar,
      wallet_pubkey: t.wallet_pubkey,
      registered_at: t.registered_at,
      pnl, roi, sharpe,
      max_drawdown: maxDD,
      current_balance: currentBalance,
      start_balance: startBalance,
      unrealized_pnl: (latest?.unrealized_pnl || 0) - (first?.unrealized_pnl || 0),
      realized_pnl: (latest?.realized_pnl || 0) - (first?.realized_pnl || 0),
      margin_used: latest?.margin_used || 0,
      available_balance: latest?.available_balance || 0,
      notional: latest?.notional || 0,
      fees: latest?.fees || 0,
      funding: latest?.funding || 0,
      positions,
      open_orders_count: latest?.open_orders_count || 0,
      max_leverage: maxLeverage,
      balance_history: balances,
      pnl_history: snapshots.map((s) => ({
        time: s.captured_at,
        pnl: ((s.realized_pnl || 0) + (s.unrealized_pnl || 0)) - basePnl,
        balance: s.total_balance,
      })),
      snapshot_count: snapshots.length,
      last_snapshot: latest?.captured_at || null,
    };
  });

  const sortBy = req.query.sort || "pnl";
  leaderboard.sort((a, b) => {
    if (sortBy === "roi") return b.roi - a.roi;
    if (sortBy === "sharpe") return b.sharpe - a.sharpe;
    if (sortBy === "drawdown") return b.max_drawdown - a.max_drawdown;
    return b.pnl - a.pnl;
  });

  res.json({ competition: comp, leaderboard });
});

router.get("/competitions/:id/traders/:userId/snapshots", (req, res) => {
  const snapshots = q.all(
    "SELECT * FROM snapshots WHERE competition_id = ? AND user_id = ? ORDER BY captured_at ASC",
    [req.params.id, req.params.userId]
  );
  res.json(snapshots);
});

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN
// ═════════════════════════════════════════════════════════════════════════════

router.get("/admin/users", authMiddleware, adminMiddleware, (req, res) => {
  const users = q.all("SELECT id, twitter_handle, twitter_name, twitter_avatar, wallet_pubkey, is_admin, created_at FROM users ORDER BY created_at DESC");
  res.json(users);
});

// Get competitions a specific user participated in
router.get("/admin/users/:id/competitions", authMiddleware, adminMiddleware, (req, res) => {
  const comps = q.all(`
    SELECT c.*, r.wallet_pubkey, r.registered_at,
      (SELECT COUNT(*) FROM registrations r2 WHERE r2.competition_id = c.id) as trader_count
    FROM registrations r
    JOIN competitions c ON r.competition_id = c.id
    WHERE r.user_id = ?
    ORDER BY r.registered_at DESC
  `, [req.params.id]);
  res.json(comps);
});

router.put("/admin/users/:id/admin", authMiddleware, adminMiddleware, (req, res) => {
  const { is_admin } = req.body;
  q.run("UPDATE users SET is_admin = ? WHERE id = ?", [is_admin ? 1 : 0, req.params.id]);
  res.json({ ok: true });
});

// ═════════════════════════════════════════════════════════════════════════════
// GLOBAL LEADERBOARD
// ═════════════════════════════════════════════════════════════════════════════

router.get("/leaderboard", (req, res) => {
  try {
    // Get all ended competitions with their winners
    const endedComps = q.all("SELECT * FROM competitions WHERE status = 'ended' ORDER BY end_time DESC");

    // For each ended competition, figure out who won (highest PnL)
    const winsMap = {};
    const userInfo = {};

    for (const comp of endedComps) {
      const traders = q.all(`
        SELECT r.user_id, r.wallet_pubkey, u.twitter_handle, u.twitter_name, u.twitter_avatar
        FROM registrations r
        JOIN users u ON r.user_id = u.id
        WHERE r.competition_id = ?
      `, [comp.id]);

      if (traders.length === 0) continue;

      let bestPnl = -Infinity;
      let winnerId = null;

      for (const t of traders) {
        userInfo[t.user_id] = { twitter_handle: t.twitter_handle, twitter_name: t.twitter_name, twitter_avatar: t.twitter_avatar };

        const snapshots = q.all(
          "SELECT * FROM snapshots WHERE competition_id = ? AND user_id = ? ORDER BY captured_at ASC",
          [comp.id, t.user_id]
        );

        if (snapshots.length === 0) continue;

        const first = snapshots[0];
        const latest = snapshots[snapshots.length - 1];

        const basePnl = (first.realized_pnl || 0) + (first.unrealized_pnl || 0);
        const currentPnl = (latest.realized_pnl || 0) + (latest.unrealized_pnl || 0);
        const pnl = currentPnl - basePnl;

        if (!winsMap[t.user_id]) {
          winsMap[t.user_id] = { wins: 0, degenWins: 0, totalPnl: 0, compsPlayed: 0 };
        }
        winsMap[t.user_id].totalPnl += pnl;
        winsMap[t.user_id].compsPlayed += 1;

        if (pnl > bestPnl) {
          bestPnl = pnl;
          winnerId = t.user_id;
        }
      }

      if (winnerId && winsMap[winnerId]) {
        winsMap[winnerId].wins += 1;
        // Detect degen: duration_hours <= 0.25 OR actual duration <= 20 minutes
        const actualMinutes = (new Date(comp.end_time) - new Date(comp.start_time)) / 60000;
        const isDegen = comp.duration_hours <= 0.5 || actualMinutes <= 20;
        if (isDegen) winsMap[winnerId].degenWins += 1;
      }
    }

    const allUsers = Object.entries(winsMap).map(([userId, stats]) => ({
      user_id: Number(userId),
      ...userInfo[userId],
      ...stats,
    }));

    const byWins = [...allUsers].filter((u) => u.wins > 0).sort((a, b) => b.wins - a.wins || b.totalPnl - a.totalPnl);
    const byPnl = [...allUsers].filter((u) => u.compsPlayed > 0).sort((a, b) => b.totalPnl - a.totalPnl);
    const byDegenWins = [...allUsers].filter((u) => u.degenWins > 0).sort((a, b) => b.degenWins - a.degenWins || b.totalPnl - a.totalPnl);

    res.json({
      most_wins: byWins.slice(0, 50),
      biggest_pnl: byPnl.slice(0, 50),
      degen_wins: byDegenWins.slice(0, 50),
      total_competitions: endedComps.length,
    });
  } catch (err) {
    console.error("[Leaderboard] Error:", err);
    res.json({
      most_wins: [],
      biggest_pnl: [],
      degen_wins: [],
      total_competitions: 0,
    });
  }
});

export default router;