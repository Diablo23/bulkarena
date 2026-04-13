import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../utils/api";

export default function Header({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";

  const handleLogin = async () => {
    try {
      const data = await api.getLoginUrl();
      if (data?.url) window.location.href = data.url;
    } catch (err) { console.error(err); }
  };

  return (
    <header className="header">
      <div className="flex items-center gap-16">
        <div className="logo" onClick={() => navigate("/")}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <span>BULK ARENA</span>
        </div>
        <button
          className="btn"
          style={{ fontSize: 12, padding: "5px 12px", background: location.pathname === "/leaderboard" ? "var(--bg-hover)" : undefined }}
          onClick={() => navigate("/leaderboard")}
        >
          🏆 Leaderboard
        </button>
      </div>

      <div className="flex items-center gap-12">
        {!isHome && location.pathname !== "/leaderboard" && (
          <button className="btn" onClick={() => navigate("/")}>
            ← Back
          </button>
        )}
        {user ? (
          <div className="flex items-center gap-8">
            {user.is_admin && (
              <button className="btn" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => navigate("/admin")}>
                ⚙ Admin
              </button>
            )}
            {user.twitter_avatar && (
              <img src={user.twitter_avatar} alt="" className="avatar avatar-sm" />
            )}
            <span style={{ fontSize: 13, fontWeight: 500 }}>@{user.twitter_handle}</span>
            <button className="btn" style={{ fontSize: 12, padding: "4px 10px" }} onClick={onLogout}>
              Logout
            </button>
          </div>
        ) : (
          <button className="btn" onClick={handleLogin} style={{ fontSize: 12, padding: "6px 14px" }}>
            Sign in with X
          </button>
        )}
      </div>
    </header>
  );
}
