// ── Reports & points routes ──
const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { audit, instructorOwnsClass, hasPermission } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth, requireRole('instructor', 'admin'));

// Convert an array of flat objects to CSV text.
function toCSV(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
}

// GET /reports/class/:id?format=json|csv
router.get('/class/:id', (req, res) => {
  const classId = Number(req.params.id);
  if (!instructorOwnsClass(req.user.id, classId) && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Not your class' });
  if (!hasPermission(req.user, classId, 'can_export_reports'))
    return res.status(403).json({ error: 'Permission denied: export reports' });

  const rows = db.prepare(
    `SELECT u.full_name AS student, sp.total_points AS points, sp.current_streak AS streak,
            (SELECT COUNT(*) FROM student_task_progress p JOIN tasks t ON t.id=p.task_id
               WHERE p.student_id=u.id AND t.class_id=? AND p.status='completed') AS tasks_completed,
            (SELECT ROUND(AVG(focus_percentage)) FROM study_sessions s
               WHERE s.student_id=u.id AND s.class_id=?) AS avg_focus
     FROM class_enrollments e JOIN users u ON u.id=e.student_id
     JOIN student_profiles sp ON sp.user_id=u.id
     WHERE e.class_id=? AND e.enrollment_status='active'
     ORDER BY sp.total_points DESC`
  ).all(classId, classId, classId);

  audit(req.user.id, 'export_class_report', 'class', classId, null);
  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="class-${classId}-report.csv"`);
    return res.send(toCSV(rows));
  }
  res.json(rows);
});

// GET /reports/student/:id
router.get('/student/:id', (req, res) => {
  const studentId = Number(req.params.id);
  // Instructor must share a class with the student.
  const shared = db.prepare(
    `SELECT c.id FROM classes c JOIN class_enrollments e ON e.class_id=c.id
     WHERE c.instructor_id=? AND e.student_id=? LIMIT 1`
  ).get(req.user.id, studentId);
  if (!shared && req.user.role !== 'admin')
    return res.status(403).json({ error: 'No shared class with this student' });

  const rows = db.prepare(
    `SELECT t.title AS task, c.class_name AS class, p.progress_percent, p.status, p.points_earned
     FROM student_task_progress p JOIN tasks t ON t.id=p.task_id JOIN classes c ON c.id=t.class_id
     WHERE p.student_id=? ORDER BY c.class_name, t.title`
  ).all(studentId);
  audit(req.user.id, 'export_student_report', 'user', studentId, null);
  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="student-${studentId}-report.csv"`);
    return res.send(toCSV(rows));
  }
  res.json(rows);
});

// POST /points/adjust — manual points adjustment with required reason (audited)
router.post('/points/adjust', (req, res) => {
  const { student_id, class_id, delta, reason, task_id } = req.body || {};
  if (!student_id || !delta || !reason || !String(reason).trim())
    return res.status(400).json({ error: 'student_id, delta and a reason are required' });
  if (class_id && !hasPermission(req.user, class_id, 'can_award_points'))
    return res.status(403).json({ error: 'Permission denied: award points' });

  const tx = db.transaction(() => {
    db.prepare('UPDATE student_profiles SET total_points = MAX(0, total_points + ?) WHERE user_id = ?')
      .run(Math.round(delta), student_id);
    db.prepare('INSERT INTO points_audit (student_id, actor_id, task_id, delta, reason) VALUES (?, ?, ?, ?, ?)')
      .run(student_id, req.user.id, task_id || null, Math.round(delta), reason.trim());
  });
  tx();
  audit(req.user.id, 'adjust_points', 'user', student_id, { delta, reason });
  res.json({ ok: true, new_total: db.prepare('SELECT total_points FROM student_profiles WHERE user_id = ?').get(student_id).total_points });
});

// GET /points/audit/:studentId — points audit trail
router.get('/points/audit/:studentId', (req, res) => {
  const rows = db.prepare(
    `SELECT pa.*, a.full_name AS actor_name FROM points_audit pa
     LEFT JOIN users a ON a.id = pa.actor_id
     WHERE pa.student_id = ? ORDER BY pa.created_at DESC LIMIT 100`
  ).all(Number(req.params.studentId));
  res.json(rows);
});

module.exports = router;
