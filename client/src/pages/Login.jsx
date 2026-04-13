import React, { useState } from "react";
import { api } from "../utils/api";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const data = await api.getLoginUrl();
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Login error:", err);
      setLoading(false);
    }
  };

  return (
    <div className="container fade-in" style={{ textAlign: "center", paddingTop: 80 }}>
      <div style={{ maxWidth: 400, margin: "0 auto" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
        <h1 className="mono" style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>BULK ARENA</h1>
        <p className="text-muted" style={{ fontSize: 14, marginBottom: 32 }}>
          Sign in with X/Twitter to join trading competitions on Bulk Exchange.
        </p>

        <button className="btn btn-twitter" onClick={handleLogin} disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
          {loading ? (
            <span className="flex items-center gap-8"><span className="spinner" style={{ width: 16, height: 16 }} /> Connecting...</span>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Sign in with X
            </>
          )}
        </button>

        <div className="text-muted" style={{ fontSize: 12, marginTop: 24 }}>
          Your Twitter identity is used for display only.<br />
          We never post or access your tweets.
        </div>
      </div>
    </div>
  );
}
