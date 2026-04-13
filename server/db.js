import initSqlJs from "sql.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = join(DATA_DIR, "arena.db");

let db;
let saveTimer;

export async function initDb() {
  const SQL = await initSqlJs();

  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run("PRAGMA foreign_keys = ON;");
  initTables();

  // Auto-save to disk every 10 seconds
  saveTimer = setInterval(() => saveDb(), 10000);

  return db;
}

export function getDb() {
  if (!db) throw new Error("Database not initialized. Call initDb() first.");
  return db;
}

export function saveDb() {
  if (!db) return;
  try {
    const data = db.export();
    writeFileSync(DB_PATH, Buffer.from(data));
  } catch (err) {
    console.error("[DB] Save error:", err.message);
  }
}

// ─── Query helpers (mimic better-sqlite3 style) ────────────────────────────

export const q = {
  run(sql, params = []) {
    db.run(sql, params);
    saveDb();
    const r = db.exec("SELECT last_insert_rowid() as id");
    return { lastInsertRowid: r[0]?.values[0][0] || 0 };
  },

  get(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  },

  all(sql, params = []) {
    const results = [];
    const stmt = db.prepare(sql);
    stmt.bind(params);
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },
};

// ─── Tables ─────────────────────────────────────────────────────────────────

function initTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      twitter_id TEXT UNIQUE NOT NULL,
      twitter_handle TEXT NOT NULL,
      twitter_name TEXT NOT NULL,
      twitter_avatar TEXT,
      wallet_pubkey TEXT,
      is_admin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS competitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration_hours REAL NOT NULL,
      max_traders INTEGER NOT NULL DEFAULT 50,
      start_balance REAL NOT NULL DEFAULT 10000,
      status TEXT DEFAULT 'upcoming' CHECK(status IN ('upcoming','live','ended','cancelled')),
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      wallet_pubkey TEXT NOT NULL,
      registered_at TEXT DEFAULT (datetime('now')),
      UNIQUE(competition_id, user_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      wallet_pubkey TEXT NOT NULL,
      total_balance REAL,
      available_balance REAL,
      margin_used REAL,
      notional REAL,
      realized_pnl REAL,
      unrealized_pnl REAL,
      fees REAL,
      funding REAL,
      positions_json TEXT,
      open_orders_count INTEGER DEFAULT 0,
      captured_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  try {
    db.run("CREATE INDEX IF NOT EXISTS idx_snapshots_comp ON snapshots(competition_id, user_id, captured_at)");
    db.run("CREATE INDEX IF NOT EXISTS idx_registrations_comp ON registrations(competition_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)");
  } catch {}
}
