// ── Admin routes: manage users, instructors, courses, system settings ──
const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { hashPassword } = require('../utils/auth');
const { audit, isEmail, nonEmpty } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

// GET /admin/users
router.get('/users', (req, res) => {
  const rows = db.prepare(
    'SELECT id, full_name, email, role, status, created_at FROM users ORDER BY created_at DESC'
  ).all();
  res.json(rows);
});

// POST /admin/users — create any role (including instructor/admin)
router.post('/users', (req, res) => {
  const { full_name, email, password, role } = req.body || {};
  if (!nonEmpty(full_name) || !isEmail(email) || !nonEmpty(password))
    return res.status(400).json({ error: 'full_name, email and password are required' });
  const r = ['student', 'instructor', 'admin'].includes(role) ? role : 'student';
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email.toLowerCase()))
    return res.status(409).json({ error: 'Email already in use' });
  const info = db.prepare(
    'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(full_name.trim(), email.toLowerCase(), hashPassword(password), r);
  if (r === 'student') db.prepare('INSERT INTO student_profiles (user_id) VALUES (?)').run(info.lastInsertRowid);
  if (r === 'instructor') db.prepare('INSERT INTO instructor_profiles (user_id) VALUES (?)').run(info.lastInsertRowid);
  audit(req.user.id, 'admin_create_user', 'user', info.lastInsertRowid, { role: r });
  res.status(201).json(db.prepare('SELECT id, full_name, email, role, status FROM users WHERE id = ?').get(info.lastInsertRowid));
});

// PATCH /admin/users/:id — update status/role
router.patch('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const { status, role, full_name } = req.body || {};
  const fields = [], vals = [];
  if (status && ['active', 'suspended', 'pending'].includes(status)) { fields.push('status = ?'); vals.push(status); }
  if (role && ['student', 'instructor', 'admin'].includes(role)) { fields.push('role = ?'); vals.push(role); }
  if (nonEmpty(full_name)) { fields.push('full_name = ?'); vals.push(full_name.trim()); }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
  fields.push("updated_at = datetime('now')");
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...vals, id);
  audit(req.user.id, 'admin_update_user', 'user', id, req.body);
  res.json(db.prepare('SELECT id, full_name, email, role, status FROM users WHERE id = ?').get(id));
});

// DELETE /admin/users/:id
router.delete('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  audit(req.user.id, 'admin_delete_user', 'user', id, null);
  res.json({ ok: true });
});

// GET /admin/stats — system overview
router.get('/stats', (req, res) => {
  const count = (t) => db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
  res.json({
    users: count('users'),
    students: db.prepare("SELECT COUNT(*) n FROM users WHERE role='student'").get().n,
    instructors: db.prepare("SELECT COUNT(*) n FROM users WHERE role='instructor'").get().n,
    courses: count('courses'),
    classes: count('classes'),
    tasks: count('tasks'),
    study_sessions: count('study_sessions'),
  });
});

// GET /admin/audit-log
router.get('/audit-log', (req, res) => {
  res.json(db.prepare(
    `SELECT al.*, u.full_name AS actor_name FROM audit_logs al
     LEFT JOIN users u ON u.id = al.actor_id ORDER BY al.created_at DESC LIMIT 300`
  ).all());
});

module.exports = router;
