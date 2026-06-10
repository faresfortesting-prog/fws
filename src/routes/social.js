// ── Announcements & messaging routes ──
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { audit, instructorOwnsClass, hasPermission, nonEmpty } = require('../utils/helpers');

const router = express.Router();
// NOTE: this router is mounted at '/', so auth is applied per-route (not router-wide)
// to avoid intercepting unrelated paths like /api/health.

function isEnrolled(studentId, classId) {
  return !!db.prepare(
    "SELECT 1 FROM class_enrollments WHERE student_id = ? AND class_id = ? AND enrollment_status='active'"
  ).get(studentId, classId);
}

// POST /announcements — instructor posts to a class
router.post('/announcements', requireAuth, (req, res) => {
  if (req.user.role === 'student') return res.status(403).json({ error: 'Students cannot post announcements' });
  const { class_id, title, message, pinned } = req.body || {};
  if (!class_id || !nonEmpty(title) || !nonEmpty(message))
    return res.status(400).json({ error: 'class_id, title and message are required' });
  if (!hasPermission(req.user, class_id, 'can_send_announcements'))
    return res.status(403).json({ error: 'Permission denied: send announcements' });
  const info = db.prepare(
    'INSERT INTO announcements (class_id, instructor_id, title, message, pinned) VALUES (?, ?, ?, ?, ?)'
  ).run(class_id, req.user.id, title.trim(), message.trim(), pinned ? 1 : 0);
  audit(req.user.id, 'post_announcement', 'class', class_id, { title });
  res.status(201).json(db.prepare('SELECT * FROM announcements WHERE id = ?').get(info.lastInsertRowid));
});

// GET /announcements?class_id= — for a class, or all of a student's classes
router.get('/announcements', requireAuth, (req, res) => {
  const classId = req.query.class_id ? Number(req.query.class_id) : null;
  let rows;
  if (classId) {
    const ok = req.user.role === 'admin' || instructorOwnsClass(req.user.id, classId) || isEnrolled(req.user.id, classId);
    if (!ok) return res.status(403).json({ error: 'Not authorized' });
    rows = db.prepare(
      `SELECT a.*, u.full_name AS instructor_name, c.class_name FROM announcements a
       JOIN users u ON u.id = a.instructor_id JOIN classes c ON c.id = a.class_id
       WHERE a.class_id = ? ORDER BY a.pinned DESC, a.created_at DESC`
    ).all(classId);
  } else if (req.user.role === 'student') {
    rows = db.prepare(
      `SELECT a.*, u.full_name AS instructor_name, c.class_name FROM announcements a
       JOIN users u ON u.id = a.instructor_id JOIN classes c ON c.id = a.class_id
       JOIN class_enrollments e ON e.class_id = a.class_id
       WHERE e.student_id = ? AND e.enrollment_status='active'
       ORDER BY a.pinned DESC, a.created_at DESC`
    ).all(req.user.id);
  } else {
    rows = db.prepare(
      `SELECT a.*, c.class_name FROM announcements a JOIN classes c ON c.id = a.class_id
       WHERE a.instructor_id = ? ORDER BY a.created_at DESC`
    ).all(req.user.id);
  }
  res.json(rows);
});

// POST /messages — send a direct or class-wide message
router.post('/messages', requireAuth, (req, res) => {
  const { receiver_id, class_id, subject, body } = req.body || {};
  if (!nonEmpty(body)) return res.status(400).json({ error: 'Message body is required' });
  // Instructors messaging a class need permission.
  if (req.user.role !== 'student' && class_id && !receiver_id) {
    if (!hasPermission(req.user, class_id, 'can_message_students'))
      return res.status(403).json({ error: 'Permission denied: message students' });
  }
  const info = db.prepare(
    'INSERT INTO messages (sender_id, receiver_id, class_id, subject, body) VALUES (?, ?, ?, ?, ?)'
  ).run(req.user.id, receiver_id || null, class_id || null, subject || null, body.trim());
  res.status(201).json(db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid));
});

// GET /messages — inbox (direct messages to me + class messages for my classes) + unread count
router.get('/messages', requireAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT m.*, su.full_name AS sender_name FROM messages m
     JOIN users su ON su.id = m.sender_id
     WHERE m.receiver_id = ?
        OR (m.receiver_id IS NULL AND m.class_id IN (
              SELECT class_id FROM class_enrollments WHERE student_id = ? AND enrollment_status='active'
              UNION SELECT id FROM classes WHERE instructor_id = ?))
        OR m.sender_id = ?
     ORDER BY m.created_at DESC LIMIT 100`
  ).all(req.user.id, req.user.id, req.user.id, req.user.id);
  const unread = rows.filter(m => m.receiver_id === req.user.id && !m.read_at).length;
  res.json({ messages: rows, unread });
});

// PATCH /messages/:id/read
router.patch('/messages/:id/read', requireAuth, (req, res) => {
  db.prepare("UPDATE messages SET read_at = datetime('now') WHERE id = ? AND receiver_id = ?")
    .run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
