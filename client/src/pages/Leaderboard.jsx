import React, { useState, useEffect } from "react";
import { Spinner, EmptyState } from "../components/UI";
import { fmtUsd } from "../utils/api";

const API = "/api";

export default function LeaderboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("wins");

  useEffect(() => {
    fetch(`${API}/leaderboard`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => {
        setData({ most_wins: [], biggest_pnl: [], degen_wins: [], total_competitions: 0 });
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="container fade-in" style={{ textAlign: "center", paddingTop: 80 }}><Spinner /></div>;
  }

  if (!data) {
    return <EmptyState icon="🏆" title="Could not load leaderboard" />;
  }

  const tabs = [
    { key: "wins", label: "🏆 Most Wins", data: data.most_wins },
    { key: "pnl", label: "💰 Biggest PnL", data: data.biggest_pnl },
    { key: "degen", label: "⚡ Degen Kings", data: data.degen_wins },
  ];

  const activeTab = tabs.find((t) => t.key === tab);
  const rows = activeTab?.data || [];

  return (
    <div className="container fade-in">
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 className="mono" style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Global Leaderboard</h1>
        <p className="text-muted" style={{ fontSize: 13 }}>
          Across {data.total_competitions} completed competition{data.total_competitions !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Tabs */}
      <div className="tab-bar mb-24" style={{ justifyContent: "center", margin: "0 auto 24px", width: "fit-content" }}>
        {tabs.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)} style={{ padding: "8px 18px", fontSize: 13 }}>
            {t.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={tab === "degen" ? "⚡" : "🏆"}
          title={tab === "degen" ? "No degen competitions completed yet." : "No completed competitions yet."}
          subtitle="Compete and finish tournaments to appear here."
        />
      ) : (
        <div className="card">
          {/* Table header */}
          <div
            className="table-header"
            style={{ gridTemplateColumns: tab === "pnl" ? "50px 2fr 1fr 1fr 1fr" : "50px 2fr 1fr 1fr 1fr" }}
          >
            <span>#</span>
            <span>Trader</span>
            {tab === "wins" && <><span className="text-right">Wins</span><span className="text-right">Played</span><span className="text-right">Total PnL</span></>}
            {tab === "pnl" && <><span className="text-right">Total PnL</span><span className="text-right">Played</span><span className="text-right">Wins</span></>}
            {tab === "degen" && <><span className="text-right">Degen Wins</span><span className="text-right">Total Wins</span><span className="text-right">Total PnL</span></>}
          </div>

          {rows.map((r, i) => {
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
            const pnlColor = r.totalPnl >= 0 ? "var(--green)" : "var(--red)";

            return (
              <div
                key={r.user_id}
                className="table-row"
                style={{ gridTemplateColumns: "50px 2fr 1fr 1fr 1fr", cursor: "default" }}
              >
                <span style={{ fontSize: 15, textAlign: "center" }}>{medal}</span>
                <div className="flex items-center gap-8">
                  {r.twitter_avatar && <img src={r.twitter_avatar} alt="" className="avatar avatar-sm" />}
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{r.twitter_name || r.twitter_handle}</div>
                    <div className="text-muted mono" style={{ fontSize: 11 }}>@{r.twitter_handle}</div>
                  </div>
                </div>

                {tab === "wins" && (
                  <>
                    <div className="text-right mono fw-600" style={{ fontSize: 15, color: "var(--yellow)" }}>{r.wins}</div>
                    <div className="text-right mono text-muted" style={{ fontSize: 13 }}>{r.compsPlayed}</div>
                    <div className="text-right mono" style={{ fontSize: 13, color: pnlColor }}>{fmtUsd(r.totalPnl)}</div>
                  </>
                )}

                {tab === "pnl" && (
                  <>
                    <div className="text-right mono fw-600" style={{ fontSize: 15, color: pnlColor }}>{fmtUsd(r.totalPnl)}</div>
                    <div className="text-right mono text-muted" style={{ fontSize: 13 }}>{r.compsPlayed}</div>
                    <div className="text-right mono" style={{ fontSize: 13, color: "var(--yellow)" }}>{r.wins}</div>
                  </>
                )}

                {tab === "degen" && (
                  <>
                    <div className="text-right mono fw-600" style={{ fontSize: 15, color: "var(--purple)" }}>{r.degenWins} ⚡</div>
                    <div className="text-right mono text-muted" style={{ fontSize: 13 }}>{r.wins}</div>
                    <div className="text-right mono" style={{ fontSize: 13, color: pnlColor }}>{fmtUsd(r.totalPnl)}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
