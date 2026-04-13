import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, timeLeft, timeToStart } from "../utils/api";
import { Pulse, StatusTag, EmptyState, Spinner } from "../components/UI";

export default function HomePage({ user }) {
  const [comps, setComps] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.listCompetitions().then((data) => { setComps(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="container fade-in" style={{ textAlign: "center", paddingTop: 80 }}>
        <Spinner />
      </div>
    );
  }

  return (
    <div className="container fade-in">
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <h1 className="mono" style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
          Trading Competitions
        </h1>
        <p className="text-muted" style={{ fontSize: 15 }}>
          Register your wallet. Compete in real-time. Prove your edge on Bulk.
        </p>
        {!user && (
          <button
            className="btn btn-twitter"
            style={{ marginTop: 16, padding: "10px 24px", fontSize: 14 }}
            onClick={async () => {
              try {
                const data = await api.getLoginUrl();
                if (data?.url) window.location.href = data.url;
              } catch (err) { console.error(err); }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style={{ marginRight: 8 }}>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Sign in with X
          </button>
        )}
      </div>

      {comps.length === 0 ? (
        <EmptyState icon="🏆" title="No competitions yet." subtitle="Check back soon or ask an admin to create one." />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {comps.map((c) => {
            const isLive = c.status === "live";
            const isUpcoming = c.status === "upcoming";
            return (
              <div
                key={c.id}
                className="card"
                style={{ cursor: "pointer", transition: "border-color 0.15s" }}
                onClick={() => navigate(`/competition/${c.id}`)}
              >
                <div className="card-body flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-8 mb-8">
                      {isLive && <Pulse />}
                      <span style={{ fontWeight: 600, fontSize: 17 }}>{c.name}</span>
                      <StatusTag status={c.status} />
                    </div>
                    <div className="flex gap-24 text-muted mono" style={{ fontSize: 12 }}>
                      <span>👥 {c.trader_count || 0}/{c.max_traders} traders</span>
                      <span>⏱ {c.duration_hours === 0.25 ? '15m' : `${c.duration_hours}h`}</span>
                      <span>💰 ${Number(c.start_balance).toLocaleString()} start</span>
                      {isLive && <span>🕐 {timeLeft(c.end_time)}</span>}
                      {isUpcoming && <span>🕐 {timeToStart(c.start_time)}</span>}
                    </div>
                  </div>
                  <span className="text-muted" style={{ fontSize: 20 }}>→</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
