// ── Student routes: join class, progress, sessions, dashboard data ──
const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { audit, instructorOwnsClass, hasPermission, nonEmpty } = require('../utils/helpers');
const { syncStudent } = require('../services/blackboard');

const router = express.Router();
router.use(requireAuth);

// POST /students/import-blackboard — fetch a Blackboard .ics feed and import deadlines as tasks.
router.post('/import-blackboard', requireRole('student'), async (req, res) => {
  const url = (req.body && req.body.ics_url || '').trim();
  if (!/^https?:\/\//i.test(url))
    return res.status(400).json({ error: 'Please provide a valid Blackboard calendar (.ics) link' });
  try {
    const result = await syncStudent(req.user.id, url);
    audit(req.user.id, 'import_blackboard', 'user', req.user.id, result);
    res.json({ imported: result.imported, total_events: result.total, subjects: result.subjects });
  } catch (e) {
    res.status(502).json({ error: e.message || 'Could not import from Blackboard' });
  }
});

// GET /students/me/blackboard-url — the saved feed URL + last sync (to prefill the import field).
router.get('/me/blackboard-url', requireRole('student'), (req, res) => {
  const row = db.prepare('SELECT blackboard_ics_url, blackboard_last_sync FROM student_profiles WHERE user_id = ?').get(req.user.id);
  res.json({ ics_url: row ? row.blackboard_ics_url : null, last_sync: row ? row.blackboard_last_sync : null });
});

// Can the requester view this student's detail?
// Self, admin, or an instructor who shares a class with the student (with permission).
function canViewStudent(user, studentId) {
  if (user.role === 'admin') return true;
  if (user.id === studentId) return true;
  if (user.role !== 'instructor') return false;
  const shared = db.prepare(
    `SELECT c.id FROM classes c
     JOIN class_enrollments e ON e.class_id = c.id
     WHERE c.instructor_id = ? AND e.student_id = ? AND e.enrollment_status='active' LIMIT 1`
  ).get(user.id, studentId);
  if (!shared) return false;
  return hasPermission(user, shared.id, 'can_view_study_sessions');
}

// POST /students/join-class — join via class code
router.post('/join-class', requireRole('student'), (req, res) => {
  const code = (req.body && req.body.code || '').trim().toUpperCase();
  if (!nonEmpty(code)) return res.status(400).json({ error: 'A class code is required' });

  const cls = db.prepare('SELECT * FROM classes WHERE join_code = ?').get(code);
  if (!cls) return res.status(404).json({ error: 'No class found for that code' });
  if (cls.status !== 'active') return res.status(400).json({ error: 'This class is not active' });

  const existing = db.prepare('SELECT * FROM class_enrollments WHERE class_id = ? AND student_id = ?')
    .get(cls.id, req.user.id);
  const status = cls.approval_mode ? 'pending' : 'active';
  if (existing) {
    if (existing.enrollment_status === 'removed')
      db.prepare('UPDATE class_enrollments SET enrollment_status = ? WHERE id = ?').run(status, existing.id);
    else
      return res.status(409).json({ error: 'You are already enrolled in this class' });
  } else {
    db.prepare('INSERT INTO class_enrollments (class_id, student_id, enrollment_status) VALUES (?, ?, ?)')
      .run(cls.id, req.user.id, status);
  }
  audit(req.user.id, 'join_class', 'class', cls.id, { code });
  res.status(201).json({ class: cls, enrollment_status: status });
});

// GET /students/me/classes — classes the student is enrolled in
router.get('/me/classes', requireRole('student'), (req, res) => {
  const rows = db.prepare(
    `SELECT c.id, c.class_name, c.join_code, c.status, e.enrollment_status,
            co.course_code, co.course_name, u.full_name AS instructor_name
     FROM class_enrollments e
     JOIN classes c ON c.id = e.class_id
     LEFT JOIN courses co ON co.id = c.course_id
     JOIN users u ON u.id = c.instructor_id
     WHERE e.student_id = ? AND e.enrollment_status IN ('active','pending')
     ORDER BY e.joined_at DESC`
  ).all(req.user.id);
  res.json(rows);
});

// GET /students/me/tasks — all tasks across enrolled classes (with progress)
router.get('/me/tasks', requireRole('student'), (req, res) => {
  const rows = db.prepare(
    `SELECT t.*, c.class_name, co.course_code,
            COALESCE(p.progress_percent, 0) AS progress_percent,
            COALESCE(p.status, 'not_started') AS my_status
     FROM tasks t
     JOIN classes c ON c.id = t.class_id
     LEFT JOIN courses co ON co.id = t.course_id
     JOIN class_enrollments e ON e.class_id = t.class_id
     LEFT JOIN student_task_progress p ON p.task_id = t.id AND p.student_id = ?
     WHERE e.student_id = ? AND e.enrollment_status='active' AND t.status='published'
     ORDER BY
       -- 0 = upcoming/active (top), 2 = overdue, 3 = completed (bottom)
       CASE WHEN COALESCE(p.status,'not_started')='completed' THEN 3
            WHEN t.due_date IS NOT NULL AND t.due_date < date('now') THEN 2
            ELSE 0 END ASC,
       -- overdue group: most recently passed first
       CASE WHEN t.due_date IS NOT NULL AND t.due_date < date('now')
                 AND COALESCE(p.status,'not_started')<>'completed'
            THEN julianday(t.due_date) END DESC,
       -- upcoming/completed group: soonest due first
       t.due_date IS NULL,
       t.due_date ASC`
  ).all(req.user.id, req.user.id);
  // Compute overdue state.
  const now = new Date();
  res.json(rows.map(t => ({
    ...t,
    overdue: t.due_date && t.my_status !== 'completed' && new Date(t.due_date) < now,
  })));
});

// GET /students/:id/progress
router.get('/:id/progress', (req, res) => {
  const studentId = Number(req.params.id);
  if (!canViewStudent(req.user, studentId))
    return res.status(403).json({ error: 'Not authorized to view this student' });
  if (req.user.role === 'instructor')
    audit(req.user.id, 'view_student_progress', 'user', studentId, null);

  const profile = db.prepare(
    `SELECT u.full_name, u.email, sp.* FROM users u
     JOIN student_profiles sp ON sp.user_id = u.id WHERE u.id = ?`
  ).get(studentId);
  const tasks = db.prepare(
    `SELECT t.title, t.points, t.due_date, t.urgency, c.class_name,
            COALESCE(p.progress_percent,0) AS progress_percent,
            COALESCE(p.status,'not_started') AS status, p.points_earned
     FROM student_task_progress p
     JOIN tasks t ON t.id = p.task_id
     JOIN classes c ON c.id = t.class_id
     WHERE p.student_id = ? ORDER BY t.due_date`
  ).all(studentId);
  res.json({ profile, tasks });
});

// GET /students/:id/sessions
router.get('/:id/sessions', (req, res) => {
  const studentId = Number(req.params.id);
  if (!canViewStudent(req.user, studentId))
    return res.status(403).json({ error: 'Not authorized' });
  const rows = db.prepare(
    `SELECT s.*, t.title AS task_title FROM study_sessions s
     LEFT JOIN tasks t ON t.id = s.task_id
     WHERE s.student_id = ? ORDER BY s.started_at DESC LIMIT 100`
  ).all(studentId);
  res.json(rows);
});

module.exports = router;
