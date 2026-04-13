import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header";
import HomePage from "./pages/Home";
import CompetitionPage from "./pages/Competition";
import AdminPage from "./pages/Admin";
import LeaderboardPage from "./pages/Leaderboard";
import LoginPage from "./pages/Login";
import { api, setToken, clearToken } from "./utils/api";
import { Spinner } from "./components/UI";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      // Handle OAuth callback token from URL
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const error = params.get("error");

      if (token) {
        console.log("[Auth] Token received from callback");
        setToken(token);
        // Clean URL
        window.history.replaceState({}, "", window.location.pathname);
      }
      if (error) {
        console.error("[Auth] OAuth error:", error);
        window.history.replaceState({}, "", window.location.pathname);
      }

      // Check if we have a token (either just received or from localStorage)
      const saved = localStorage.getItem("arena_token");
      if (saved) {
        try {
          const u = await api.getMe();
          if (u) {
            console.log("[Auth] Logged in as:", u.twitter_handle);
            setUser(u);
          }
        } catch (err) {
          console.error("[Auth] getMe failed:", err);
          clearToken();
        }
      }
      setLoading(false);
    }
    init();
  }, []);

  const handleLogout = async () => {
    try { await api.logout(); } catch {}
    clearToken();
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Header user={user} onLogout={handleLogout} />
      <Routes>
        <Route path="/" element={<HomePage user={user} />} />
        <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/competition/:id" element={<CompetitionPage user={user} />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/admin" element={user?.is_admin ? <AdminPage user={user} /> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
