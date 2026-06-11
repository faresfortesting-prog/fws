// ── Instructor routes: dashboard, classes CRUD, courses, verification review ──
const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  audit, generateJoinCode, instructorOwnsClass,
  ensurePermissions, hasPermission, nonEmpty,
} = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth, requireRole('instructor', 'admin'));

// Classes taught by this instructor (admins see all).
function instructorClassIds(user) {
  const rows = user.role === 'admin'
    ? db.prepare('SELECT id FROM classes').all()
    : db.prepare('SELECT id FROM classes WHERE instructor_id = ?').all(user.id);
  return rows.map(r => r.id);
}

// GET /instructor/dashboard — overview KPIs
router.get('/dashboard', (req, res) => {
  const classIds = instructorClassIds(req.user);
  if (classIds.length === 0) {
    return res.json({
      totalStudents: 0, activeToday: 0, avgFocus: 0, totalStudyHours: 0,
      tasksCompleted: 0, studentsAtRisk: 0, leaderboard: [], classes: [],
    });
  }
  const ph = classIds.map(() => '?').join(',');

  const totalStudents = db.prepare(
    `SELECT COUNT(DISTINCT student_id) n FROM class_enrollments
     WHERE class_id IN (${ph}) AND enrollment_status = 'active'`
  ).get(...classIds).n;

  const activeToday = db.prepare(
    `SELECT COUNT(DISTINCT s.student_id) n FROM study_sessions s
     WHERE s.class_id IN (${ph}) AND date(s.started_at) = date('now')`
  ).get(...classIds).n;

  const focusAgg = db.prepare(
    `SELECT AVG(focus_percentage) f, SUM(actual_focus_minutes) m
     FROM study_sessions WHERE class_id IN (${ph}) AND ended_at IS NOT NULL`
  ).get(...classIds);

  const tasksCompleted = db.prepare(
    `SELECT COUNT(*) n FROM student_task_progress p
     JOIN tasks t ON t.id = p.task_id
     WHERE t.class_id IN (${ph}) AND p.status = 'completed'`
  ).get(...classIds).n;

  // At-risk: enrolled students with low avg focus OR no recent activity.
  const studentsAtRisk = db.prepare(
    `SELECT COUNT(*) n FROM (
       SELECT e.student_id,
         (SELECT AVG(focus_percentage) FROM study_sessions s
            WHERE s.student_id = e.student_id AND s.class_id IN (${ph})) af,
         (SELECT MAX(started_at) FROM study_sessions s
            WHERE s.student_id = e.student_id AND s.class_id IN (${ph})) la
       FROM (SELECT DISTINCT student_id FROM class_enrollments
             WHERE class_id IN (${ph}) AND enrollment_status='active') e
     ) WHERE af IS NULL OR af < 50 OR la IS NULL OR la < datetime('now','-7 days')`
  ).get(...classIds, ...classIds, ...classIds).n;

  const leaderboard = db.prepare(
    `SELECT u.full_name AS name, sp.total_points AS points, sp.current_streak AS streak
     FROM (SELECT DISTINCT student_id FROM class_enrollments
           WHERE class_id IN (${ph}) AND enrollment_status='active') e
     JOIN users u ON u.id = e.student_id
     JOIN student_profiles sp ON sp.user_id = u.id
     ORDER BY sp.total_points DESC LIMIT 5`
  ).all(...classIds);

  const classes = db.prepare(
    `SELECT c.id, c.class_name, c.join_code, c.status,
            (SELECT COUNT(*) FROM class_enrollments e
              WHERE e.class_id = c.id AND e.enrollment_status='active') AS student_count
     FROM classes c WHERE c.id IN (${ph}) ORDER BY c.created_at DESC`
  ).all(...classIds);

  res.json({
    totalStudents,
    activeToday,
    avgFocus: Math.round(focusAgg.f || 0),
    totalStudyHours: Math.round((focusAgg.m || 0) / 60 * 10) / 10,
    tasksCompleted,
    studentsAtRisk,
    leaderboard,
    classes,
  });
});

// GET /instructor/classes
router.get('/classes', (req, res) => {
  const classIds = instructorClassIds(req.user);
  if (classIds.length === 0) return res.json([]);
  const ph = classIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT c.*, co.course_code, co.course_name,
            (SELECT COUNT(*) FROM class_enrollments e
              WHERE e.class_id = c.id AND e.enrollment_status='active') AS student_count,
            (SELECT COUNT(*) FROM tasks t WHERE t.class_id = c.id) AS task_count
     FROM classes c LEFT JOIN courses co ON co.id = c.course_id
     WHERE c.id IN (${ph}) ORDER BY c.created_at DESC`
  ).all(...classIds);
  res.json(rows);
});

// POST /instructor/classes — create a class (and optionally a course)
router.post('/classes', (req, res) => {
  const { class_name, course_id, course_code, course_name, semester, approval_mode } = req.body || {};
  if (!nonEmpty(class_name)) return res.status(400).json({ error: 'Class name is required' });

  let courseId = course_id || null;
  if (!courseId && nonEmpty(course_code) && nonEmpty(course_name)) {
    const info = db.prepare(
      `INSERT INTO courses (course_code, course_name, semester, created_by_instructor_id)
       VALUES (?, ?, ?, ?)`
    ).run(course_code.trim(), course_name.trim(), semester || null, req.user.id);
    courseId = info.lastInsertRowid;
  }

  const joinCode = generateJoinCode();
  const info = db.prepare(
    `INSERT INTO classes (course_id, instructor_id, class_name, join_code, approval_mode)
     VALUES (?, ?, ?, ?, ?)`
  ).run(courseId, req.user.id, class_name.trim(), joinCode, approval_mode ? 1 : 0);
  const classId = info.lastInsertRowid;
  ensurePermissions(req.user.id, classId);
  audit(req.user.id, 'create_class', 'class', classId, { class_name });

  res.status(201).json(db.prepare('SELECT * FROM classes WHERE id = ?').get(classId));
});

// PATCH /instructor/classes/:id — edit / archive
router.patch('/classes/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!instructorOwnsClass(req.user.id, id) && req.user.role !== 'admin')
    return res.status(403).json({ error: 'You do not teach this class' });

  const { class_name, status, approval_mode, start_date, end_date, course_id } = req.body || {};
  const fields = [], vals = [];
  if (class_name !== undefined) { fields.push('class_name = ?'); vals.push(class_name); }
  if (status !== undefined) { fields.push('status = ?'); vals.push(status); }
  if (approval_mode !== undefined) { fields.push('approval_mode = ?'); vals.push(approval_mode ? 1 : 0); }
  if (start_date !== undefined) { fields.push('start_date = ?'); vals.push(start_date); }
  if (end_date !== undefined) { fields.push('end_date = ?'); vals.push(end_date); }
  if (course_id !== undefined) { fields.push('course_id = ?'); vals.push(course_id); }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });

  db.prepare(`UPDATE classes SET ${fields.join(', ')} WHERE id = ?`).run(...vals, id);
  audit(req.user.id, 'update_class', 'class', id, req.body);
  res.json(db.prepare('SELECT * FROM classes WHERE id = ?').get(id));
});

// DELETE /instructor/classes/:id
router.delete('/classes/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!instructorOwnsClass(req.user.id, id) && req.user.role !== 'admin')
    return res.status(403).json({ error: 'You do not teach this class' });
  db.prepare('DELETE FROM classes WHERE id = ?').run(id);
  audit(req.user.id, 'delete_class', 'class', id, null);
  res.json({ ok: true });
});

// ── Courses ──
// GET /instructor/courses
router.get('/courses', (req, res) => {
  const rows = req.user.role === 'admin'
    ? db.prepare('SELECT * FROM courses ORDER BY created_at DESC').all()
    : db.prepare('SELECT * FROM courses WHERE created_by_instructor_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows);
});

// POST /instructor/courses
router.post('/courses', (req, res) => {
  const { course_code, course_name, description, semester } = req.body || {};
  if (!nonEmpty(course_code) || !nonEmpty(course_name))
    return res.status(400).json({ error: 'Course code and name are required' });
  const info = db.prepare(
    `INSERT INTO courses (course_code, course_name, description, semester, created_by_instructor_id)
     VALUES (?, ?, ?, ?, ?)`
  ).run(course_code.trim(), course_name.trim(), description || null, semester || null, req.user.id);
  audit(req.user.id, 'create_course', 'course', info.lastInsertRowid, { course_code });
  res.status(201).json(db.prepare('SELECT * FROM courses WHERE id = ?').get(info.lastInsertRowid));
});

// PATCH /instructor/courses/:id
router.patch('/courses/:id', (req, res) => {
  const id = Number(req.params.id);
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(id);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  if (course.created_by_instructor_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Not your course' });
  const { course_code, course_name, description, semester, status } = req.body || {};
  const fields = [], vals = [];
  for (const [k, v] of Object.entries({ course_code, course_name, description, semester, status })) {
    if (v !== undefined) { fields.push(`${k} = ?`); vals.push(v); }
  }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
  db.prepare(`UPDATE courses SET ${fields.join(', ')} WHERE id = ?`).run(...vals, id);
  res.json(db.prepare('SELECT * FROM courses WHERE id = ?').get(id));
});

// GET /instructor/calendar — all upcoming task deadlines across the instructor's classes
router.get('/calendar', (req, res) => {
  const classIds = instructorClassIds(req.user);
  if (classIds.length === 0) return res.json([]);
  const ph = classIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT t.id, t.title, t.due_date, t.task_type, t.urgency, t.points, c.class_name,
            (SELECT COUNT(*) FROM student_task_progress p WHERE p.task_id = t.id AND p.status='completed') AS completed,
            (SELECT COUNT(*) FROM class_enrollments e WHERE e.class_id = t.class_id AND e.enrollment_status='active') AS enrolled
     FROM tasks t JOIN classes c ON c.id = t.class_id
     WHERE t.class_id IN (${ph}) AND t.due_date IS NOT NULL AND t.status='published'
     ORDER BY t.due_date ASC`
  ).all(...classIds);
  res.json(rows);
});

// GET /instructor/verification-events — privacy-safe verification review feed
router.get('/verification-events', (req, res) => {
  const classIds = instructorClassIds(req.user);
  if (classIds.length === 0) return res.json([]);
  const ph = classIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT v.id, v.event_type, v.event_time, v.reason, v.severity,
            u.full_name AS student_name, s.id AS session_id,
            s.focus_percentage, s.verification_status, t.title AS task_title
     FROM verification_events v
     JOIN study_sessions s ON s.id = v.study_session_id
     JOIN users u ON u.id = s.student_id
     LEFT JOIN tasks t ON t.id = s.task_id
     WHERE s.class_id IN (${ph})
     ORDER BY v.event_time DESC LIMIT 200`
  ).all(...classIds);
  res.json(rows);
});

// GET /instructor/audit-log — sensitive action history
router.get('/audit-log', (req, res) => {
  const rows = req.user.role === 'admin'
    ? db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200').all()
    : db.prepare('SELECT * FROM audit_logs WHERE actor_id = ? ORDER BY created_at DESC LIMIT 200').all(req.user.id);
  res.json(rows);
});

// GET /instructor/permissions/:classId — view permission flags
router.get('/permissions/:classId', (req, res) => {
  const classId = Number(req.params.classId);
  if (!instructorOwnsClass(req.user.id, classId) && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Not your class' });
  ensurePermissions(req.user.id, classId);
  res.json(db.prepare(
    'SELECT * FROM instructor_permissions WHERE class_id = ? AND instructor_id = ?'
  ).get(classId, req.user.id));
});

module.exports = router;
