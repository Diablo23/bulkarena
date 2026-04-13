import cron from "node-cron";
import { q } from "./db.js";
import { fetchFullAccount } from "./bulk-api.js";

export function startPoller() {
  cron.schedule("*/30 * * * * *", async () => {
    await pollLiveCompetitions();
  });

  cron.schedule("* * * * *", () => {
    updateCompetitionStatuses();
  });

  console.log("[Poller] Started - polling every 30s");
}

async function pollLiveCompetitions() {
  const liveComps = q.all("SELECT id FROM competitions WHERE status = 'live'");
  if (liveComps.length === 0) return;

  for (const comp of liveComps) {
    const registrations = q.all(
      "SELECT r.user_id, r.wallet_pubkey FROM registrations r WHERE r.competition_id = ?",
      [comp.id]
    );

    for (const reg of registrations) {
      try {
        const account = await fetchFullAccount(reg.wallet_pubkey);
        if (!account) continue;

        const margin = account.margin || {};
        const positions = account.positions || [];
        const openOrders = account.openOrders || [];

        q.run(
          "INSERT INTO snapshots (competition_id, user_id, wallet_pubkey, total_balance, available_balance, margin_used, notional, realized_pnl, unrealized_pnl, fees, funding, positions_json, open_orders_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [comp.id, reg.user_id, reg.wallet_pubkey, margin.totalBalance || 0, margin.availableBalance || 0, margin.marginUsed || 0, margin.notional || 0, margin.realizedPnl || 0, margin.unrealizedPnl || 0, margin.fees || 0, margin.funding || 0, JSON.stringify(positions), openOrders.length]
        );
      } catch (err) {
        console.error(`[Poller] Error snapshotting ${reg.wallet_pubkey}:`, err.message);
      }
    }
  }
}

function updateCompetitionStatuses() {
  const now = new Date().toISOString();
  q.run("UPDATE competitions SET status = 'live' WHERE status = 'upcoming' AND start_time <= ?", [now]);
  q.run("UPDATE competitions SET status = 'ended' WHERE status = 'live' AND end_time <= ?", [now]);
}
