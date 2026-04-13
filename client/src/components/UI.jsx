import React from "react";

export function Pulse() {
  return <span className="pulse-dot" />;
}

export function StatusTag({ status }) {
  const cls = status === "live" ? "tag-live" : status === "upcoming" ? "tag-upcoming" : "tag-ended";
  const label = status === "live" ? "LIVE" : status === "upcoming" ? "UPCOMING" : "ENDED";
  return <span className={`tag ${cls}`}>{label}</span>;
}

export function StatCard({ label, value, color, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color || "var(--text-primary)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function MiniChart({ data, color = "var(--green)", width = 120, height = 32 }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ width, height, opacity: 0.3, fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        No data
      </div>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`)
    .join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function Spinner() {
  return <div className="spinner" />;
}

export function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="card" style={{ padding: 48, textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>{icon}</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>{title}</div>
      {subtitle && <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}

export function Badge({ icon, label }) {
  return (
    <span
      title={label}
      style={{
        background: "#1a1a10",
        border: "1px solid #3d3d1a",
        borderRadius: 6,
        padding: "3px 8px",
        fontSize: 12,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {icon} <span className="mono" style={{ fontSize: 11 }}>{label}</span>
    </span>
  );
}

const BADGES = [
  { id: "profit_king", label: "Profit King", icon: "👑", check: (s) => s.pnl > 10000 },
  { id: "risk_master", label: "Risk Master", icon: "🛡️", check: (s) => s.sharpe > 2 },
  { id: "iron_hands", label: "Iron Hands", icon: "💎", check: (s) => s.max_drawdown > -0.05 && s.pnl > 0 },
  { id: "whale", label: "Whale", icon: "🐋", check: (s) => s.current_balance > 100000 },
  { id: "degen", label: "Degen", icon: "🎰", check: (s) => s.max_leverage >= 20 },
  { id: "consistent", label: "Consistent", icon: "📈", check: (s) => s.roi > 0.1 },
];

export function getBadges(traderStats) {
  return BADGES.filter((b) => b.check(traderStats));
}
