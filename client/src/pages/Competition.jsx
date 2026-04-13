import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { api, fmtUsd, fmtPct, fmtNum, shortKey, timeLeft, timeToStart } from "../utils/api";
import { Pulse, StatusTag, StatCard, MiniChart, EmptyState, Spinner, getBadges, Badge } from "../components/UI";

function EquityChart({ data, startBalance }) {
  const containerRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [dims, setDims] = useState({ w: 1000, h: 200 });

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      if (width > 0) setDims({ w: width, h: 200 });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  if (!data || data.length < 2) return null;

  const W = dims.w;
  const H = dims.h;
  const PAD_TOP = 20;
  const PAD_BOTTOM = 30;
  const PAD_LEFT = 60;
  const PAD_RIGHT = 20;
  const chartW = W - PAD_LEFT - PAD_RIGHT;
  const chartH = H - PAD_TOP - PAD_BOTTOM;

  const pnls = data.map((d) => d.pnl);
  const minPnl = Math.min(0, ...pnls);
  const maxPnl = Math.max(0, ...pnls);
  const range = maxPnl - minPnl || 1;

  const toX = (i) => PAD_LEFT + (i / (data.length - 1)) * chartW;
  const toY = (v) => PAD_TOP + chartH - ((v - minPnl) / range) * chartH;
  const zeroY = toY(0);

  // Build line path
  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(d.pnl)}`).join(" ");

  // Build fill path (area from line to zero)
  // Split into positive and negative fills
  const points = data.map((d, i) => ({ x: toX(i), y: toY(d.pnl), pnl: d.pnl }));

  // Green fill (above zero)
  let greenPath = "";
  let redPath = "";
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i === 0) {
      greenPath += `M${p.x},${zeroY}`;
      redPath += `M${p.x},${zeroY}`;
    }
    greenPath += `L${p.x},${p.pnl >= 0 ? p.y : zeroY}`;
    redPath += `L${p.x},${p.pnl <= 0 ? p.y : zeroY}`;
  }
  greenPath += `L${points[points.length - 1].x},${zeroY}Z`;
  redPath += `L${points[points.length - 1].x},${zeroY}Z`;

  // Time labels
  const timeLabels = [];
  const labelCount = Math.min(6, data.length);
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.round((i / (labelCount - 1)) * (data.length - 1));
    const d = data[idx];
    const date = new Date(d.time);
    timeLabels.push({ x: toX(idx), label: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
  }

  // PnL axis labels
  const pnlLabels = [];
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const val = minPnl + (range * i) / steps;
    pnlLabels.push({ y: toY(val), label: `$${val >= 0 ? "+" : ""}${val.toFixed(0)}` });
  }

  // Handle mouse
  const handleMouse = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const relX = mx - PAD_LEFT;
    if (relX < 0 || relX > chartW) { setHover(null); return; }
    const idx = Math.round((relX / chartW) * (data.length - 1));
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    setHover(clamped);
  };

  const hoverData = hover !== null ? data[hover] : null;

  return (
    <div ref={containerRef} style={{ position: "relative", userSelect: "none" }}>
      <svg
        width={W}
        height={H}
        style={{ display: "block", cursor: "crosshair" }}
        onMouseMove={handleMouse}
        onMouseLeave={() => setHover(null)}
      >
        {/* Grid lines */}
        {pnlLabels.map((p, i) => (
          <line key={i} x1={PAD_LEFT} x2={W - PAD_RIGHT} y1={p.y} y2={p.y} stroke="#1e2028" strokeWidth="1" />
        ))}

        {/* Zero line */}
        <line x1={PAD_LEFT} x2={W - PAD_RIGHT} y1={zeroY} y2={zeroY} stroke="#2a2d35" strokeWidth="1" strokeDasharray="4,4" />

        {/* Green fill */}
        <path d={greenPath} fill="#22c55e" opacity="0.1" />
        {/* Red fill */}
        <path d={redPath} fill="#ef4444" opacity="0.1" />

        {/* Line */}
        {data.map((d, i) => {
          if (i === 0) return null;
          const prev = data[i - 1];
          const color = d.pnl >= 0 ? "#22c55e" : "#ef4444";
          const prevColor = prev.pnl >= 0 ? "#22c55e" : "#ef4444";
          return (
            <line
              key={i}
              x1={toX(i - 1)}
              y1={toY(prev.pnl)}
              x2={toX(i)}
              y2={toY(d.pnl)}
              stroke={d.pnl >= 0 && prev.pnl >= 0 ? "#22c55e" : d.pnl < 0 && prev.pnl < 0 ? "#ef4444" : "#6b7280"}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          );
        })}

        {/* Y axis labels */}
        {pnlLabels.map((p, i) => (
          <text key={i} x={PAD_LEFT - 8} y={p.y + 4} fill="#6b7280" fontSize="10" fontFamily="JetBrains Mono, monospace" textAnchor="end">
            {p.label}
          </text>
        ))}

        {/* X axis time labels */}
        {timeLabels.map((t, i) => (
          <text key={i} x={t.x} y={H - 8} fill="#6b7280" fontSize="10" fontFamily="JetBrains Mono, monospace" textAnchor="middle">
            {t.label}
          </text>
        ))}

        {/* Hover crosshair + dot */}
        {hover !== null && hoverData && (
          <>
            <line x1={toX(hover)} x2={toX(hover)} y1={PAD_TOP} y2={H - PAD_BOTTOM} stroke="#4b5563" strokeWidth="1" strokeDasharray="3,3" />
            <circle cx={toX(hover)} cy={toY(hoverData.pnl)} r="5" fill={hoverData.pnl >= 0 ? "#22c55e" : "#ef4444"} stroke="#0d0f13" strokeWidth="2" />
          </>
        )}
      </svg>

      {/* Hover tooltip */}
      {hover !== null && hoverData && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: Math.min(toX(hover) + 12, W - 180),
            background: "#1a1d23",
            border: "1px solid #2a2d35",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 12,
            fontFamily: "JetBrains Mono, monospace",
            pointerEvents: "none",
            zIndex: 10,
            minWidth: 150,
          }}
        >
          <div style={{ color: "#9ca3af", marginBottom: 4 }}>
            {new Date(hoverData.time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
          <div style={{ color: hoverData.pnl >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700, fontSize: 15 }}>
            {hoverData.pnl >= 0 ? "+" : ""}${hoverData.pnl.toFixed(2)}
          </div>
          <div style={{ color: "#6b7280", marginTop: 2 }}>
            Balance: ${hoverData.balance.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CompetitionPage({ user }) {
  const { id } = useParams();
  const [comp, setComp] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [sortBy, setSortBy] = useState("pnl");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [walletInput, setWalletInput] = useState("");
  const [joining, setJoining] = useState(false);
  const [selectedTrader, setSelectedTrader] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const pollRef = useRef(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const data = await api.getLeaderboard(id, sortBy);
      setComp(data.competition);
      setLeaderboard(data.leaderboard);
      setLastUpdate(Date.now());
    } catch (err) {
      console.error(err);
    }
  }, [id, sortBy]);

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard().then(() => setLoading(false));
  }, [fetchLeaderboard]);

  // Poll every 30s
  useEffect(() => {
    pollRef.current = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(pollRef.current);
  }, [fetchLeaderboard]);

  const handleJoin = async () => {
    const pubkey = walletInput || user?.wallet_pubkey;
    if (!pubkey || pubkey.length < 32) {
      setError("Enter a valid Bulk Trade public key");
      return;
    }
    setJoining(true);
    setError(null);
    try {
      await api.register(id, pubkey);
      setWalletInput("");
      await fetchLeaderboard();
    } catch (err) {
      setError(err.message);
    }
    setJoining(false);
  };

  const isRegistered = user && leaderboard.some((t) => t.user_id === user.id);
  const canJoin = user && comp && (comp.status === "live" || comp.status === "upcoming") && !isRegistered;
  const isFull = comp && leaderboard.length >= comp.max_traders;

  if (loading) {
    return (
      <div className="container fade-in" style={{ textAlign: "center", paddingTop: 80 }}>
        <Spinner />
      </div>
    );
  }

  if (!comp) {
    return <EmptyState icon="❌" title="Competition not found" />;
  }

  // Trader detail view
  if (selectedTrader) {
    const t = selectedTrader;
    const badges = getBadges(t);
    const pnlColor = t.pnl >= 0 ? "var(--green)" : "var(--red)";

    return (
      <div className="container fade-in">
        <button className="btn mb-24" onClick={() => setSelectedTrader(null)}>← Back to Leaderboard</button>

        {/* Trader header */}
        <div className="flex items-center gap-16 mb-24" style={{ flexWrap: "wrap" }}>
          <div className="flex items-center gap-12">
            {t.twitter_avatar && <img src={t.twitter_avatar} alt="" className="avatar" style={{ width: 48, height: 48 }} />}
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{t.twitter_name || t.twitter_handle}</div>
              <div className="flex items-center gap-8">
                <span className="text-muted mono" style={{ fontSize: 12 }}>@{t.twitter_handle}</span>
                <span className="text-muted" style={{ fontSize: 11 }}>•</span>
                <span className="text-muted mono" style={{ fontSize: 12 }}>{shortKey(t.wallet_pubkey)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-8" style={{ marginLeft: "auto", flexWrap: "wrap" }}>
            {badges.map((b) => <Badge key={b.id} icon={b.icon} label={b.label} />)}
          </div>
        </div>

        {/* Stats */}
        <div className="stat-grid mb-24">
          <StatCard label="Total PnL" value={fmtUsd(t.pnl)} color={pnlColor} />
          <StatCard label="ROI" value={fmtPct(t.roi)} color={pnlColor} />
          <StatCard label="Sharpe Ratio" value={fmtNum(t.sharpe)} color={t.sharpe > 1 ? "var(--green)" : "var(--text-muted)"} />
          <StatCard label="Max Drawdown" value={fmtPct(t.max_drawdown)} color={t.max_drawdown < -0.1 ? "var(--red)" : "var(--green)"} />
          <StatCard label="Balance" value={fmtUsd(t.current_balance)} />
          <StatCard label="Available" value={fmtUsd(t.available_balance)} />
          <StatCard label="Margin Used" value={fmtUsd(t.margin_used)} />
          <StatCard label="Max Leverage" value={t.max_leverage > 0 ? `${fmtNum(t.max_leverage, 1)}x` : "—"} color={t.max_leverage >= 20 ? "var(--red)" : "var(--text-primary)"} />
          <StatCard label="Unrealized PnL" value={fmtUsd(t.unrealized_pnl)} color={t.unrealized_pnl >= 0 ? "var(--green)" : "var(--red)"} />
          <StatCard label="Notional" value={fmtUsd(t.notional)} />
        </div>

        {/* Equity curve */}
        <div className="card mb-24">
          <div className="card-body">
            <div className="label mb-8">Equity Curve</div>
            {t.pnl_history && t.pnl_history.length >= 2 ? (
              <EquityChart data={t.pnl_history} startBalance={t.start_balance} />
            ) : (
              <div className="text-muted" style={{ padding: "24px 0", textAlign: "center", fontSize: 13 }}>
                Waiting for snapshots... (updates every 30s)
              </div>
            )}
          </div>
        </div>

        {/* Positions table */}
        <div className="card">
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>
            Open Positions ({t.positions?.length || 0})
          </div>
          {!t.positions || t.positions.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No open positions</div>
          ) : (
            <>
              <div className="table-header" style={{ gridTemplateColumns: "1fr 80px 1fr 1fr 1fr 1fr 80px" }}>
                <span>Symbol</span><span>Side</span><span className="text-right">Size</span>
                <span className="text-right">Entry</span><span className="text-right">Mark</span>
                <span className="text-right">uPnL</span><span className="text-right">Lev</span>
              </div>
              {t.positions.map((p, i) => {
                const isLong = p.size > 0;
                return (
                  <div key={i} className="mono" style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr 1fr 1fr 1fr 80px", gap: 8, padding: "12px 20px", borderBottom: "1px solid #14161b", fontSize: 13 }}>
                    <span style={{ fontWeight: 500 }}>{p.symbol}</span>
                    <span style={{ color: isLong ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{isLong ? "LONG" : "SHORT"}</span>
                    <span className="text-right">{fmtNum(Math.abs(p.size), 4)}</span>
                    <span className="text-right">{fmtUsd(p.price)}</span>
                    <span className="text-right">{fmtUsd(p.fairPrice)}</span>
                    <span className="text-right" style={{ color: (p.unrealizedPnl || 0) >= 0 ? "var(--green)" : "var(--red)" }}>{fmtUsd(p.unrealizedPnl)}</span>
                    <span className="text-right">{fmtNum(p.leverage, 1)}x</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    );
  }

  // Competition main view
  return (
    <div className="container fade-in">
      {error && (
        <div className="alert-error">
          {error}
          <span onClick={() => setError(null)}>✕</span>
        </div>
      )}

      {/* Header stats */}
      <div className="mb-24">
        <div className="flex items-center gap-12 mb-8" style={{ flexWrap: "wrap" }}>
          {comp.status === "live" && <Pulse />}
          <h2 className="mono" style={{ fontSize: 24, fontWeight: 700 }}>{comp.name}</h2>
          <StatusTag status={comp.status} />
        </div>
        {comp.description && (
          <p className="text-muted mb-16" style={{ fontSize: 13 }}>{comp.description}</p>
        )}
        <div className="stat-grid">
          <StatCard label="Duration" value={`${comp.duration_hours}h`} />
          <StatCard label="Traders" value={`${leaderboard.length}/${comp.max_traders}`} />
          <StatCard label={comp.status === "upcoming" ? "Starts In" : "Time Left"} value={comp.status === "upcoming" ? timeToStart(comp.start_time) : timeLeft(comp.end_time)} color={comp.status === "live" ? "var(--green)" : comp.status === "upcoming" ? "var(--yellow)" : "var(--red)"} />
          <StatCard label="Start Balance" value={fmtUsd(comp.start_balance)} />
        </div>
      </div>

      {/* Join section */}
      {canJoin && !isFull && (
        <div className="card mb-24">
          <div className="card-body">
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 2, minWidth: 240 }}>
                <label className="label">WALLET PUBLIC KEY</label>
                <input
                  className="input input-mono"
                  placeholder={user.wallet_pubkey || "Your Bulk Trade public key (base58)"}
                  value={walletInput}
                  onChange={(e) => setWalletInput(e.target.value)}
                />
                {user.wallet_pubkey && !walletInput && (
                  <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                    Will use saved wallet: {shortKey(user.wallet_pubkey)}
                  </div>
                )}
              </div>
              <button className="btn btn-primary" onClick={handleJoin} disabled={joining}>
                {joining ? "Joining..." : "⚡ Join Competition"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isRegistered && (
        <div className="card mb-24" style={{ borderColor: "var(--green-border)" }}>
          <div className="card-body flex items-center justify-between">
            <span style={{ color: "var(--green)", fontSize: 13 }}>✓ You are registered in this competition</span>
          </div>
        </div>
      )}

      {isFull && !isRegistered && (
        <div className="card mb-24" style={{ borderColor: "var(--yellow)" }}>
          <div className="card-body">
            <span style={{ color: "var(--yellow)", fontSize: 13 }}>Competition is full ({comp.max_traders}/{comp.max_traders} traders)</span>
          </div>
        </div>
      )}

      {/* Sort + last update */}
      <div className="flex justify-between items-center mb-16" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="tab-bar">
          {[["pnl", "PnL"], ["roi", "ROI"], ["sharpe", "Sharpe"], ["drawdown", "Drawdown"]].map(([key, label]) => (
            <button key={key} className={`tab ${sortBy === key ? "active" : ""}`} onClick={() => setSortBy(key)}>
              {label}
            </button>
          ))}
        </div>
        {lastUpdate && (
          <div className="flex items-center text-muted mono" style={{ fontSize: 11 }}>
            <Pulse />
            Updated {Math.floor((Date.now() - lastUpdate) / 1000)}s ago
          </div>
        )}
      </div>

      {/* Leaderboard */}
      {leaderboard.length === 0 ? (
        <EmptyState icon="👥" title="No traders yet." subtitle={user ? "Be the first to join!" : "Sign in with X to join."} />
      ) : (
        <div className="card">
          <div className="table-header" style={{ gridTemplateColumns: "44px 2fr 1fr 1fr 1fr 1fr 100px 80px" }}>
            <span>#</span><span>Trader</span><span className="text-right">PnL</span>
            <span className="text-right">ROI</span><span className="text-right">Sharpe</span>
            <span className="text-right">Max DD</span><span className="text-center">Equity</span>
            <span className="text-center">Badges</span>
          </div>
          {leaderboard.map((t, i) => {
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
            const pnlColor = t.pnl > 0 ? "var(--green)" : t.pnl < 0 ? "var(--red)" : "var(--text-primary)";
            const badges = getBadges(t);
            return (
              <div
                key={t.user_id}
                className="table-row"
                style={{ gridTemplateColumns: "44px 2fr 1fr 1fr 1fr 1fr 100px 80px" }}
                onClick={() => setSelectedTrader(t)}
              >
                <span style={{ fontSize: 15, textAlign: "center" }}>{medal}</span>
                <div className="flex items-center gap-8">
                  {t.twitter_avatar && <img src={t.twitter_avatar} alt="" className="avatar avatar-sm" />}
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{t.twitter_name || t.twitter_handle}</div>
                    <div className="text-muted mono" style={{ fontSize: 11 }}>@{t.twitter_handle}</div>
                  </div>
                </div>
                <div className="text-right mono fw-600" style={{ color: pnlColor, fontSize: 13 }}>{fmtUsd(t.pnl)}</div>
                <div className="text-right mono" style={{ color: pnlColor, fontSize: 13 }}>{fmtPct(t.roi)}</div>
                <div className="text-right mono" style={{ fontSize: 13 }}>{fmtNum(t.sharpe)}</div>
                <div className="text-right mono" style={{ color: t.max_drawdown < -0.1 ? "var(--red)" : "var(--text-muted)", fontSize: 13 }}>{fmtPct(t.max_drawdown)}</div>
                <div className="text-center">
                  <MiniChart data={t.balance_history} color={t.pnl >= 0 ? "var(--green)" : "var(--red)"} width={90} height={28} />
                </div>
                <div className="text-center flex gap-8" style={{ justifyContent: "center", flexWrap: "wrap" }}>
                  {badges.slice(0, 3).map((b) => (
                    <span key={b.id} title={b.label} style={{ fontSize: 14, cursor: "default" }}>{b.icon}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
