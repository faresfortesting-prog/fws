// ── Shared helpers: audit logging, permissions, validation, codes ──
const { db } = require('../db');

// Write a sensitive-action audit log entry.
function audit(actorId, action, targetType, targetId, detail) {
  db.prepare(
    `INSERT INTO audit_logs (actor_id, action, target_type, target_id, detail)
     VALUES (?, ?, ?, ?, ?)`
  ).run(actorId, action, targetType || null, targetId || null,
        detail ? (typeof detail === 'string' ? detail : JSON.stringify(detail)) : null);
}

// Generate a unique class join code (e.g. SS-A1B2C3). Retries on collision.
function generateJoinCode() {
  const exists = db.prepare('SELECT 1 FROM classes WHERE join_code = ?');
  for (let i = 0; i < 50; i++) {
    const code = 'SS-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    if (!exists.get(code)) return code;
  }
  throw new Error('Could not generate a unique join code');
}

// Does this instructor own (teach) this class?
function instructorOwnsClass(instructorId, classId) {
  return !!db.prepare('SELECT 1 FROM classes WHERE id = ? AND instructor_id = ?')
    .get(classId, instructorId);
}

// Check a specific permission flag for an instructor on a class.
// Admins always pass. Returns true/false.
function hasPermission(user, classId, flag) {
  if (user.role === 'admin') return true;
  if (user.role !== 'instructor') return false;
  if (!instructorOwnsClass(user.id, classId)) return false;
  const perm = db.prepare(
    'SELECT * FROM instructor_permissions WHERE instructor_id = ? AND class_id = ?'
  ).get(user.id, classId);
  if (!perm) return true; // owner with no explicit row defaults to allowed
  return perm[flag] === 1;
}

// Ensure a default permissions row exists for an instructor/class pair.
function ensurePermissions(instructorId, classId) {
  const existing = db.prepare(
    'SELECT 1 FROM instructor_permissions WHERE instructor_id = ? AND class_id = ?'
  ).get(instructorId, classId);
  if (!existing) {
    db.prepare('INSERT INTO instructor_permissions (instructor_id, class_id) VALUES (?, ?)')
      .run(instructorId, classId);
  }
}

// Basic validators
const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

module.exports = {
  audit, generateJoinCode, instructorOwnsClass,
  hasPermission, ensurePermissions, isEmail, nonEmpty,
};
