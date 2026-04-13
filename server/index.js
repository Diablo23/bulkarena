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

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

// API routes
app.use("/api", routes);

// Serve static frontend in production
const distPath = join(__dirname, "..", "client", "dist");
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(join(distPath, "index.html"));
  });
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Initialize DB (async for sql.js)
async function start() {
  await initDb();
  console.log("[DB] Initialized");

  // Start poller
  startPoller();

  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║           ⚡ BULK ARENA SERVER ⚡               ║
╠══════════════════════════════════════════════════╣
║  API:     http://localhost:${PORT}/api              ║
║  Client:  ${CLIENT_URL}                    ║
║  Health:  http://localhost:${PORT}/api/health        ║
╚══════════════════════════════════════════════════╝
    `);
  });
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
