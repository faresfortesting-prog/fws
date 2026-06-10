// ── Task routes: edit, duplicate, delete (instructor) ──
const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { audit, hasPermission } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth, requireRole('instructor', 'admin'));

function loadOwnedTask(req, res) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(req.params.id));
  if (!task) { res.status(404).json({ error: 'Task not found' }); return null; }
  return task;
}

// PATCH /tasks/:id
router.patch('/:id', (req, res) => {
  const task = loadOwnedTask(req, res); if (!task) return;
  if (!hasPermission(req.user, task.class_id, 'can_edit_tasks'))
    return res.status(403).json({ error: 'Permission denied: edit tasks' });

  const allowed = ['title', 'description', 'task_type', 'points',
    'estimated_time', 'due_date', 'urgency', 'status'];
  const fields = [], vals = [];
  for (const k of allowed) {
    if (req.body[k] !== undefined) { fields.push(`${k} = ?`); vals.push(req.body[k]); }
  }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
  db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...vals, task.id);
  audit(req.user.id, 'edit_task', 'task', task.id, req.body);
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id));
});

// POST /tasks/:id/duplicate
router.post('/:id/duplicate', (req, res) => {
  const task = loadOwnedTask(req, res); if (!task) return;
  if (!hasPermission(req.user, task.class_id, 'can_create_tasks'))
    return res.status(403).json({ error: 'Permission denied' });
  const info = db.prepare(
    `INSERT INTO tasks (class_id, course_id, instructor_id, title, description, task_type,
                        points, estimated_time, due_date, urgency, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`
  ).run(task.class_id, task.course_id, task.instructor_id, task.title + ' (copy)',
        task.description, task.task_type, task.points, task.estimated_time,
        task.due_date, task.urgency);
  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid));
});

// DELETE /tasks/:id
router.delete('/:id', (req, res) => {
  const task = loadOwnedTask(req, res); if (!task) return;
  if (!hasPermission(req.user, task.class_id, 'can_delete_tasks'))
    return res.status(403).json({ error: 'Permission denied: delete tasks' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
  audit(req.user.id, 'delete_task', 'task', task.id, { title: task.title });
  res.json({ ok: true });
});

module.exports = router;
