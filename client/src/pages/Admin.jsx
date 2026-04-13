import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, fmtUsd } from "../utils/api";
import { StatusTag, Spinner } from "../components/UI";

const API = "/api";
function getToken() { return localStorage.getItem("arena_token"); }
async function fetchUserComps(userId) {
  const res = await fetch(`${API}/admin/users/${userId}/competitions`, {
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
  });
  if (!res.ok) return [];
  return res.json();
}

export default function AdminPage({ user }) {
  const navigate = useNavigate();
  const [comps, setComps] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [tab, setTab] = useState("create");

  const [form, setForm] = useState({
    name: "",
    description: "",
    start_time: "",
    duration_hours: "3",
    max_traders: "50",
    start_balance: "10000",
  });

  useEffect(() => {
    if (!user?.is_admin) return;
    Promise.all([api.listCompetitions(), api.getUsers()])
      .then(([c, u]) => { setComps(c); setUsers(u); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  if (!user?.is_admin) {
    return (
      <div className="container fade-in" style={{ textAlign: "center", paddingTop: 80 }}>
        <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>🔒</div>
        <div className="text-muted">Admin access required.</div>
        <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
          Your Twitter handle must be whitelisted in ADMIN_TWITTER_HANDLES.
        </div>
      </div>
    );
  }

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.name || !form.start_time) {
      setError("Name and start time are required");
      return;
    }

    try {
      const result = await api.createCompetition({
        name: form.name,
        description: form.description,
        start_time: new Date(form.start_time).toISOString(),
        duration_hours: Number(form.duration_hours),
        max_traders: Number(form.max_traders),
        start_balance: Number(form.start_balance),
      });
      setSuccess(`Competition created! (ID: ${result.id}, Status: ${result.status})`);
      setForm({ name: "", description: "", start_time: "", duration_hours: "3", max_traders: "50", start_balance: "10000" });
      const compsData = await api.listCompetitions();
      setComps(compsData);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (compId) => {
    if (!confirm("Delete this competition? This cannot be undone.")) return;
    try {
      await api.deleteCompetition(compId);
      setComps(comps.filter((c) => c.id !== compId));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleAdmin = async (userId, currentAdmin) => {
    try {
      await api.toggleAdmin(userId, !currentAdmin);
      setUsers(users.map((u) => (u.id === userId ? { ...u, is_admin: !currentAdmin ? 1 : 0 } : u)));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="container" style={{ textAlign: "center", paddingTop: 80 }}><Spinner /></div>;
  }

  return (
    <div className="container fade-in" style={{ maxWidth: 800 }}>
      <h2 className="mono" style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>⚙ Admin Panel</h2>

      {error && <div className="alert-error mb-16">{error}<span onClick={() => setError(null)}>✕</span></div>}
      {success && (
        <div className="mb-16" style={{ background: "var(--green-dim)", border: "1px solid var(--green-border)", color: "var(--green)", padding: "10px 16px", borderRadius: 6, fontSize: 13 }}>
          {success}
        </div>
      )}

      {/* Tab bar */}
      <div className="tab-bar mb-24">
        {[["create", "Create Competition"], ["manage", "Manage"], ["users", "Users"]].map(([key, label]) => (
          <button key={key} className={`tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {/* Create Competition */}
      {tab === "create" && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, color: "var(--green)" }}>New Competition</h3>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className="label">COMPETITION NAME</label>
                <input className="input" placeholder="e.g. Weekend Showdown" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              <div>
                <label className="label">DESCRIPTION (OPTIONAL)</label>
                <input className="input" placeholder="Brief description..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="label">START DATE & TIME</label>
                  <input type="datetime-local" className="input" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                </div>
                <div>
                  <label className="label">DURATION</label>
                  <select className="select" value={form.duration_hours} onChange={(e) => setForm({ ...form, duration_hours: e.target.value })}>
                    <option value="0.25">15 Minutes ⚡ Degen</option>
                    <option value="3">3 Hours</option>
                    <option value="5">5 Hours</option>
                    <option value="10">10 Hours</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="label">MAX TRADERS</label>
                  <input type="number" className="input" value={form.max_traders} onChange={(e) => setForm({ ...form, max_traders: e.target.value })} />
                </div>
                <div>
                  <label className="label">START BALANCE ($)</label>
                  <input type="number" className="input" value={form.start_balance} onChange={(e) => setForm({ ...form, start_balance: e.target.value })} />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start", marginTop: 4 }}>
                ⚡ Create Competition
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Manage Competitions */}
      {tab === "manage" && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Active Competitions</h3>
            {comps.length === 0 ? (
              <div className="text-muted" style={{ textAlign: "center", padding: 24, fontSize: 13 }}>No competitions</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {comps.map((c) => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <div className="flex items-center gap-8">
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{c.name}</span>
                        <StatusTag status={c.status} />
                      </div>
                      <div className="text-muted mono" style={{ fontSize: 11, marginTop: 2 }}>
                        {c.trader_count || 0} traders • {c.duration_hours}h • {fmtUsd(c.start_balance)}
                      </div>
                    </div>
                    <div className="flex gap-8">
                      <button className="btn" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => navigate(`/competition/${c.id}`)}>View</button>
                      <button className="btn btn-danger" onClick={() => handleDelete(c.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Users */}
      {tab === "users" && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Registered Users</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  u={u}
                  isSelf={u.id === user.id}
                  onToggleAdmin={() => handleToggleAdmin(u.id, u.is_admin)}
                  navigate={navigate}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserRow({ u, isSelf, onToggleAdmin, navigate }) {
  const [expanded, setExpanded] = useState(false);
  const [comps, setComps] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (comps.length === 0) {
      setLoading(true);
      const data = await fetchUserComps(u.id);
      setComps(data);
      setLoading(false);
    }
  };

  const formatDuration = (h) => {
    if (h === 0.25) return "15m";
    return `${h}h`;
  };

  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", cursor: "pointer" }}
        onClick={handleClick}
      >
        <div className="flex items-center gap-8">
          {u.twitter_avatar && <img src={u.twitter_avatar} alt="" className="avatar avatar-sm" />}
          <div>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{u.twitter_name}</span>
            <span className="text-muted" style={{ fontSize: 12, marginLeft: 6 }}>@{u.twitter_handle}</span>
          </div>
          {u.is_admin ? <span className="tag tag-live" style={{ marginLeft: 8 }}>ADMIN</span> : null}
        </div>
        <div className="flex items-center gap-8">
          {u.wallet_pubkey && <span className="text-muted mono" style={{ fontSize: 11 }}>{u.wallet_pubkey.slice(0, 8)}…</span>}
          {!isSelf && (
            <button className="btn" style={{ fontSize: 11, padding: "3px 8px" }} onClick={(e) => { e.stopPropagation(); onToggleAdmin(); }}>
              {u.is_admin ? "Remove Admin" : "Make Admin"}
            </button>
          )}
          <span style={{ color: "var(--text-muted)", fontSize: 12, transition: "transform 0.2s", transform: expanded ? "rotate(90deg)" : "rotate(0)" }}>▶</span>
        </div>
      </div>

      {expanded && (
        <div className="fade-in" style={{ padding: "0 0 12px 40px" }}>
          {loading ? (
            <div className="text-muted" style={{ fontSize: 12, padding: 8 }}>Loading...</div>
          ) : comps.length === 0 ? (
            <div className="text-muted" style={{ fontSize: 12, padding: 8 }}>No competitions joined yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
                Competitions ({comps.length})
              </div>
              {comps.map((c) => (
                <div
                  key={c.id}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", background: "var(--bg-primary)", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                  onClick={(e) => { e.stopPropagation(); navigate(`/competition/${c.id}`); }}
                >
                  <div className="flex items-center gap-8">
                    <span style={{ fontWeight: 500 }}>{c.name}</span>
                    <StatusTag status={c.status} />
                    <span className="text-muted mono" style={{ fontSize: 11 }}>{formatDuration(c.duration_hours)}</span>
                  </div>
                  <div className="flex items-center gap-12 text-muted mono" style={{ fontSize: 11 }}>
                    <span>👥 {c.trader_count}</span>
                    <span>{new Date(c.registered_at).toLocaleDateString()}</span>
                    <span style={{ color: "var(--text-muted)" }}>→</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
