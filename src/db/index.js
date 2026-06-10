// ── Database connection (better-sqlite3, synchronous) ──
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const config = require('../config');

const dbPath = path.isAbsolute(config.databaseFile)
  ? config.databaseFile
  : path.join(__dirname, '..', '..', config.databaseFile);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply schema (idempotent — uses CREATE TABLE IF NOT EXISTS).
function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
}

module.exports = { db, migrate, dbPath };
