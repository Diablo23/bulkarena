# ⚡ Bulk Arena — Trading Competition Platform

A full-stack trading competition platform built on the [Bulk Trade](https://bulk.trade) exchange API.  
Users sign in with Twitter/X, register their wallet, and compete in real-time trading competitions.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![React](https://img.shields.io/badge/React-18-blue)
![SQLite](https://img.shields.io/badge/SQLite-3-lightgrey)

---

## Features

- **Twitter/X OAuth 2.0** — Sign in with Twitter (PKCE flow, no secrets exposed to client)
- **Admin system** — Whitelisted Twitter handles can create & manage competitions
- **Competition creation** — Set name, date, duration (3/5/10h), max traders, start balance
- **Real-time leaderboard** — PnL, ROI, Sharpe ratio, max drawdown, sorted & ranked
- **Live data polling** — Fetches Bulk Trade account data every 30 seconds
- **Trader profiles** — Equity curves, open positions, achievement badges
- **Mini charts** — Inline SVG equity sparklines on the leaderboard
- **Achievement badges** — Profit King 👑, Risk Master 🛡️, Iron Hands 💎, Whale 🐋, Degen 🎰
- **Dark terminal UI** — Matches Bulk Trade's professional trading interface style

---

## Architecture

```
bulk-arena/
├── server/                 # Express.js backend
│   ├── index.js            # Server entry point
│   ├── db.js               # SQLite database (better-sqlite3)
│   ├── auth.js             # Twitter OAuth + session management
│   ├── routes.js           # API routes (auth, competitions, leaderboard)
│   ├── bulk-api.js         # Bulk Trade API client
│   └── poller.js           # Background job: polls accounts every 30s
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx         # Root component + routing
│   │   ├── main.jsx        # Entry point
│   │   ├── index.css       # Global dark terminal styles
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route pages
│   │   └── utils/          # API helpers, formatters
│   └── index.html
├── .env.example            # Environment variables template
└── package.json            # Root workspace
```

---

## Quick Start

### 1. Prerequisites

- **Node.js 18+**
- **npm** or **pnpm**
- A **Twitter Developer App** (free tier works)

### 2. Clone & Install

```bash
git clone <your-repo>
cd bulk-arena

# Install server dependencies
cd server && npm install && cd ..

# Install client dependencies
cd client && npm install && cd ..

# Install root dev dependencies
npm install
```

### 3. Set up Twitter OAuth

1. Go to [Twitter Developer Portal](https://developer.x.com/en/portal/dashboard)
2. Create a new project/app (or use existing)
3. Under **User Authentication Settings**:
   - Enable **OAuth 2.0**
   - Type: **Web App**
   - Callback URL: `http://localhost:3001/api/auth/twitter/callback`
   - Website URL: `http://localhost:5173`
4. Copy your **Client ID** and **Client Secret**

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
TWITTER_CLIENT_ID=your_client_id_here
TWITTER_CLIENT_SECRET=your_client_secret_here
TWITTER_CALLBACK_URL=http://localhost:3001/api/auth/twitter/callback

PORT=3001
CLIENT_URL=http://localhost:5173
SESSION_SECRET=generate-a-random-32-char-string-here

# Your Twitter handle(s) for admin access (no @, comma-separated)
ADMIN_TWITTER_HANDLES=your_handle,co_admin_handle

BULK_API_URL=https://exchange-api.bulk.trade/api/v1
```

### 5. Run Development

```bash
# Terminal 1: Start server
cd server && node index.js

# Terminal 2: Start client
cd client && npx vite
```

Or with concurrently from root:

```bash
npm run dev
```

**Server** runs on `http://localhost:3001`  
**Client** runs on `http://localhost:5173` (proxies `/api` to server)

### 6. First Login

1. Open `http://localhost:5173`
2. Click **Sign in with X**
3. Authorize the app on Twitter
4. You'll be redirected back and logged in
5. If your handle is in `ADMIN_TWITTER_HANDLES`, you'll see the ⚙ Admin button

---

## API Endpoints

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/auth/twitter` | — | Get OAuth URL |
| GET | `/api/auth/twitter/callback` | — | OAuth callback |
| GET | `/api/auth/me` | ✅ | Get current user |
| POST | `/api/auth/logout` | ✅ | Logout |
| PUT | `/api/auth/wallet` | ✅ | Update wallet pubkey |

### Competitions
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/competitions` | — | List all |
| GET | `/api/competitions/:id` | — | Get one |
| POST | `/api/competitions` | Admin | Create |
| DELETE | `/api/competitions/:id` | Admin | Delete |

### Registration & Leaderboard
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/competitions/:id/register` | ✅ | Join competition |
| DELETE | `/api/competitions/:id/register` | ✅ | Leave competition |
| GET | `/api/competitions/:id/traders` | — | List traders |
| GET | `/api/competitions/:id/leaderboard` | — | Full leaderboard with metrics |

### Admin
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/users` | Admin | List all users |
| PUT | `/api/admin/users/:id/admin` | Admin | Toggle admin |

---

## Production Deployment

### Build client
```bash
cd client && npx vite build
```

The built files go to `client/dist/`. The Express server serves them automatically.

### Run production
```bash
cd server && node index.js
```

Update `.env` for production:
```env
CLIENT_URL=https://arena.yourdomain.com
TWITTER_CALLBACK_URL=https://arena.yourdomain.com/api/auth/twitter/callback
PORT=3001
```

### Hosting suggestions
- **Railway** / **Render** / **Fly.io** — Easy Node.js hosting
- **VPS** — Any Linux server with Node.js 18+
- **Reverse proxy** — Put Nginx/Caddy in front for HTTPS

---

## How It Works

1. **Users sign in** via Twitter OAuth 2.0 (PKCE flow)
2. **Admins create competitions** with name, start date, duration (3/5/10h), max traders
3. **Users register** by pasting their Bulk Trade wallet public key
4. **Background poller** fetches account data from Bulk Trade API every 30 seconds
5. **Snapshots** are stored in SQLite with full margin/position data
6. **Leaderboard** computes PnL, ROI, Sharpe ratio, and max drawdown from snapshots
7. **Competition status** auto-transitions: upcoming → live → ended based on time

---

## Bulk Trade API Integration

Uses these Bulk Trade endpoints:

| Endpoint | Purpose |
|----------|---------|
| `POST /account` (`fullAccount`) | Fetch margin, positions, orders |
| `GET /exchangeInfo` | Available markets & rules |
| `GET /ticker/{symbol}` | Current market prices |

All data fetching is **server-side** (no CORS issues, centralized rate limiting).

---

## License

MIT
