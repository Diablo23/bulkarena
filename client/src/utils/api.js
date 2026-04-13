const API = "/api";

function getToken() {
  return localStorage.getItem("arena_token");
}

export function setToken(token) {
  localStorage.setItem("arena_token", token);
}

export function clearToken() {
  localStorage.removeItem("arena_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    window.location.reload();
    return null;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  // Auth
  getLoginUrl: () => request("/auth/twitter"),
  getMe: () => request("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST" }),
  updateWallet: (pubkey) => request("/auth/wallet", { method: "PUT", body: JSON.stringify({ pubkey }) }),

  // Competitions
  listCompetitions: () => request("/competitions"),
  getCompetition: (id) => request(`/competitions/${id}`),
  createCompetition: (data) => request("/competitions", { method: "POST", body: JSON.stringify(data) }),
  deleteCompetition: (id) => request(`/competitions/${id}`, { method: "DELETE" }),

  // Registration
  register: (compId, wallet_pubkey) =>
    request(`/competitions/${compId}/register`, { method: "POST", body: JSON.stringify({ wallet_pubkey }) }),
  unregister: (compId) => request(`/competitions/${compId}/register`, { method: "DELETE" }),
  getTraders: (compId) => request(`/competitions/${compId}/traders`),

  // Leaderboard
  getLeaderboard: (compId, sort = "pnl") => request(`/competitions/${compId}/leaderboard?sort=${sort}`),
  getSnapshots: (compId, userId) => request(`/competitions/${compId}/traders/${userId}/snapshots`),

  // Admin
  getUsers: () => request("/admin/users"),
  toggleAdmin: (userId, isAdmin) =>
    request(`/admin/users/${userId}/admin`, { method: "PUT", body: JSON.stringify({ is_admin: isAdmin }) }),
};

export function shortKey(k) {
  return k ? `${k.slice(0, 4)}…${k.slice(-4)}` : "";
}

export function fmtUsd(n) {
  if (n == null || isNaN(n)) return "—";
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtPct(n) {
  if (n == null || isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(2)}%`;
}

export function fmtNum(n, d = 2) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function timeLeft(endTime) {
  const ms = new Date(endTime).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

export function timeToStart(startTime) {
  const ms = new Date(startTime).getTime() - Date.now();
  if (ms <= 0) return "Starting...";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h to start`;
  if (h > 0) return `${h}h ${m}m to start`;
  return `${m}m to start`;
}