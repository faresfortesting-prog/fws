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
  // Guarded column additions for databases created before a column existed.
  const cols = db.prepare("PRAGMA table_info(student_profiles)").all().map(c => c.name);
  if (!cols.includes('blackboard_ics_url')) {
    db.exec('ALTER TABLE student_profiles ADD COLUMN blackboard_ics_url TEXT');
  }
}

module.exports = { db, migrate, dbPath };
