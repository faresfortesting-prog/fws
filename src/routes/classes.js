// ── Class routes: join-code, students, leaderboard, tasks ──
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const {
  audit, generateJoinCode, instructorOwnsClass,
  hasPermission, ensurePermissions, nonEmpty,
} = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth);

// Is the requester allowed to view this class? (owner instructor, admin, or enrolled student)
function canViewClass(user, classId) {
  if (user.role === 'admin') return true;
  if (user.role === 'instructor') return instructorOwnsClass(user.id, classId);
  return !!db.prepare(
    "SELECT 1 FROM class_enrollments WHERE class_id = ? AND student_id = ? AND enrollment_status='active'"
  ).get(classId, user.id);
}

function requireOwner(req, res) {
  const classId = Number(req.params.id);
  if (req.user.role !== 'admin' && !instructorOwnsClass(req.user.id, classId)) {
    res.status(403).json({ error: 'You do not teach this class' });
    return null;
  }
  return classId;
}

// POST /classes/:id/join-code — regenerate the join code
router.post('/:id/join-code', (req, res) => {
  const classId = requireOwner(req, res);
  if (classId === null) return;
  const code = generateJoinCode();
  db.prepare('UPDATE classes SET join_code = ? WHERE id = ?').run(code, classId);
  audit(req.user.id, 'regenerate_join_code', 'class', classId, { code });
  res.json({ join_code: code });
});

// GET /classes/:id/students — enrolled students with summary
router.get('/:id/students', (req, res) => {
  const classId = Number(req.params.id);
  if (req.user.role === 'student' || !canViewClass(req.user, classId))
    return res.status(403).json({ error: 'Not authorized to view this class roster' });
  if (!hasPermission(req.user, classId, 'can_view_student_profiles'))
    return res.status(403).json({ error: 'Permission denied: view student profiles' });

  const rows = db.prepare(
    `SELECT u.id, u.full_name, u.email, u.avatar_url, e.enrollment_status, e.joined_at,
            sp.total_points, sp.current_streak, sp.last_active_at,
            (SELECT AVG(focus_percentage) FROM study_sessions s
               WHERE s.student_id = u.id AND s.class_id = ?) AS avg_focus,
            (SELECT COUNT(*) FROM student_task_progress p
               JOIN tasks t ON t.id = p.task_id
               WHERE p.student_id = u.id AND t.class_id = ? AND p.status='completed') AS tasks_done
     FROM class_enrollments e
     JOIN users u ON u.id = e.student_id
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     WHERE e.class_id = ? AND e.enrollment_status IN ('active','pending')
     ORDER BY sp.total_points DESC`
  ).all(classId, classId, classId);
  audit(req.user.id, 'view_class_roster', 'class', classId, null);
  res.json(rows.map(r => ({ ...r, avg_focus: Math.round(r.avg_focus || 0),
    at_risk: (r.avg_focus || 0) < 50 || !r.last_active_at })));
});

// DELETE /classes/:id/students/:studentId — remove a student
router.delete('/:id/students/:studentId', (req, res) => {
  const classId = requireOwner(req, res);
  if (classId === null) return;
  const studentId = Number(req.params.studentId);
  db.prepare("UPDATE class_enrollments SET enrollment_status='removed' WHERE class_id = ? AND student_id = ?")
    .run(classId, studentId);
  audit(req.user.id, 'remove_student', 'class', classId, { studentId });
  res.json({ ok: true });
});

// POST /classes/:id/students/:studentId/approve — approve a pending join
router.post('/:id/students/:studentId/approve', (req, res) => {
  const classId = requireOwner(req, res);
  if (classId === null) return;
  const studentId = Number(req.params.studentId);
  db.prepare("UPDATE class_enrollments SET enrollment_status='active' WHERE class_id = ? AND student_id = ?")
    .run(classId, studentId);
  audit(req.user.id, 'approve_student', 'class', classId, { studentId });
  res.json({ ok: true });
});

// GET /classes/:id/leaderboard
router.get('/:id/leaderboard', (req, res) => {
  const classId = Number(req.params.id);
  if (!canViewClass(req.user, classId))
    return res.status(403).json({ error: 'Not authorized' });
  const rows = db.prepare(
    `SELECT u.id, u.full_name AS name, sp.total_points AS points, sp.current_streak AS streak
     FROM class_enrollments e
     JOIN users u ON u.id = e.student_id
     JOIN student_profiles sp ON sp.user_id = u.id
     WHERE e.class_id = ? AND e.enrollment_status='active'
     ORDER BY sp.total_points DESC`
  ).all(classId);
  res.json(rows.map((r, i) => ({ ...r, rank: i + 1 })));
});

// GET /classes/:id/tasks
router.get('/:id/tasks', (req, res) => {
  const classId = Number(req.params.id);
  if (!canViewClass(req.user, classId))
    return res.status(403).json({ error: 'Not authorized' });
  // Students only see published tasks (with their own progress merged in).
  const studentView = req.user.role === 'student';
  const tasks = db.prepare(
    `SELECT * FROM tasks WHERE class_id = ? ${studentView ? "AND status='published'" : ''}
     ORDER BY due_date IS NULL, due_date ASC`
  ).all(classId);
  if (studentView) {
    const prog = db.prepare('SELECT * FROM student_task_progress WHERE student_id = ?').all(req.user.id);
    const map = Object.fromEntries(prog.map(p => [p.task_id, p]));
    return res.json(tasks.map(t => ({
      ...t,
      progress_percent: map[t.id]?.progress_percent || 0,
      my_status: map[t.id]?.status || 'not_started',
    })));
  }
  // Instructor view adds completion rate.
  res.json(tasks.map(t => {
    const total = db.prepare(
      "SELECT COUNT(*) n FROM class_enrollments WHERE class_id = ? AND enrollment_status='active'"
    ).get(classId).n;
    const done = db.prepare(
      "SELECT COUNT(*) n FROM student_task_progress WHERE task_id = ? AND status='completed'"
    ).get(t.id).n;
    return { ...t, completion_rate: total ? Math.round(done / total * 100) : 0 };
  }));
});

// POST /classes/:id/tasks — create a task
router.post('/:id/tasks', (req, res) => {
  const classId = Number(req.params.id);
  if (!hasPermission(req.user, classId, 'can_create_tasks'))
    return res.status(403).json({ error: 'Permission denied: create tasks' });
  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
  if (!cls) return res.status(404).json({ error: 'Class not found' });

  const { title, description, task_type, points, estimated_time, due_date, urgency, status } = req.body || {};
  if (!nonEmpty(title)) return res.status(400).json({ error: 'Task title is required' });

  const info = db.prepare(
    `INSERT INTO tasks (class_id, course_id, instructor_id, title, description, task_type,
                        points, estimated_time, due_date, urgency, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(classId, cls.course_id, cls.instructor_id, title.trim(), description || null,
        task_type || 'assignment', points || 100, estimated_time || null,
        due_date || null, urgency || 'medium', status || 'published');
  audit(req.user.id, 'create_task', 'task', info.lastInsertRowid, { title, classId });
  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid));
});

module.exports = router;
