import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
const __dirnameSelf = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirnameSelf, "..", ".env") });
import express from "express";
import cors from "cors";
import { existsSync } from "fs";
import { initDb } from "./db.js";
import routes from "./routes.js";
import { startPoller } from "./poller.js";

const __dirname = __dirnameSelf;
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const app = express();

// CORS — allow both the CLIENT_URL and the custom domain
const allowedOrigins = [CLIENT_URL, "https://bulkarena.xyz", "https://www.bulkarena.xyz"].filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, true); // allow all in production since we serve frontend from same origin
  },
  credentials: true,
}));
app.use(express.json());

// Health check (before static files)
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// API routes
app.use("/api", routes);

// Serve static frontend in production
const distPath = join(__dirname, "..", "client", "dist");
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback — serve index.html for all non-API routes
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ error: "Not found" });
    res.sendFile(join(distPath, "index.html"));
  });
}

// Initialize DB (async for sql.js)
async function start() {
  await initDb();
  console.log("[DB] Initialized");

  startPoller();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║            BULK ARENA SERVER                     ║
╠══════════════════════════════════════════════════╣
║  Port:    ${PORT}                                    ║
║  Client:  ${CLIENT_URL}
║  Health:  /api/health                            ║
╚══════════════════════════════════════════════════╝
    `);
  });
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
