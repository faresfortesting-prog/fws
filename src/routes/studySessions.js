// ── Study session + verification routes ──
const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { audit } = require('../utils/helpers');
const { checkScreenContent } = require('../utils/aiVerify');

const router = express.Router();
router.use(requireAuth);

// POST /study-sessions — start a session
router.post('/', requireRole('student'), (req, res) => {
  const { task_id, class_id, planned_minutes, webcam_enabled, screen_share_enabled } = req.body || {};
  const info = db.prepare(
    `INSERT INTO study_sessions
       (student_id, task_id, class_id, planned_minutes, webcam_enabled, screen_share_enabled, verification_status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`
  ).run(req.user.id, task_id || null, class_id || null, planned_minutes || 0,
        webcam_enabled ? 1 : 0, screen_share_enabled ? 1 : 0);
  res.status(201).json(db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(info.lastInsertRowid));
});

// PATCH /study-sessions/:id/end — finish a session, award points, sync progress
router.patch('/:id/end', requireRole('student'), (req, res) => {
  const id = Number(req.params.id);
  const session = db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(id);
  if (!session || session.student_id !== req.user.id)
    return res.status(404).json({ error: 'Session not found' });

  const { actual_focus_minutes = 0, away_minutes = 0, points_earned = 0 } = req.body || {};
  const elapsed = (actual_focus_minutes + away_minutes) || 1;
  const focusPct = Math.round(actual_focus_minutes / elapsed * 100);
  const verification = focusPct >= 60 ? 'verified' : 'flagged';

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE study_sessions SET ended_at = datetime('now'), actual_focus_minutes = ?,
        away_minutes = ?, focus_percentage = ?, points_earned = ?, verification_status = ?
       WHERE id = ?`
    ).run(actual_focus_minutes, away_minutes, focusPct, Math.round(points_earned), verification, id);

    // Award points to the student's profile.
    if (points_earned > 0) {
      db.prepare('UPDATE student_profiles SET total_points = total_points + ?, last_active_at = datetime(\'now\') WHERE user_id = ?')
        .run(Math.round(points_earned), req.user.id);
      db.prepare('INSERT INTO points_audit (student_id, actor_id, task_id, delta, reason) VALUES (?, ?, ?, ?, ?)')
        .run(req.user.id, req.user.id, session.task_id, Math.round(points_earned), 'Study session completed');
    }

    // Sync task progress (advance proportionally to verified focus time).
    if (session.task_id) {
      const existing = db.prepare('SELECT * FROM student_task_progress WHERE student_id = ? AND task_id = ?')
        .get(req.user.id, session.task_id);
      const bump = Math.min(100, Math.round(actual_focus_minutes / 2 * 10));
      const newPct = Math.min(100, (existing?.progress_percent || 0) + bump);
      const status = newPct >= 100 ? 'completed' : 'in_progress';
      if (existing) {
        db.prepare(`UPDATE student_task_progress SET progress_percent = ?, status = ?,
          points_earned = points_earned + ?, updated_at = datetime('now'),
          submitted_at = CASE WHEN ?='completed' THEN datetime('now') ELSE submitted_at END
          WHERE id = ?`).run(newPct, status, Math.round(points_earned), status, existing.id);
      } else {
        db.prepare(`INSERT INTO student_task_progress
          (student_id, task_id, progress_percent, status, points_earned)
          VALUES (?, ?, ?, ?, ?)`).run(req.user.id, session.task_id, newPct, status, Math.round(points_earned));
      }
    }

    // Update streak if first session today.
    const today = db.prepare("SELECT COUNT(*) n FROM study_sessions WHERE student_id = ? AND date(started_at)=date('now') AND ended_at IS NOT NULL").get(req.user.id).n;
    if (today === 1) {
      db.prepare('UPDATE student_profiles SET current_streak = current_streak + 1 WHERE user_id = ?').run(req.user.id);
    }
  });
  tx();

  res.json(db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(id));
});

// POST /study-sessions/:id/check-screen — server-side AI screen-content check.
// The frame is analysed and DISCARDED; only the {compliant, reason} result is returned/stored.
router.post('/:id/check-screen', requireRole('student'), async (req, res) => {
  const id = Number(req.params.id);
  const session = db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(id);
  if (!session || session.student_id !== req.user.id)
    return res.status(404).json({ error: 'Session not found' });

  const { frame_base64, task_title } = req.body || {};
  const result = await checkScreenContent(frame_base64, task_title);

  // Persist only the summary as a verification event.
  db.prepare(
    `INSERT INTO verification_events (study_session_id, event_type, reason, severity, metadata)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, result.compliant ? 'screen_ok' : 'screen_off_task',
        result.reason, result.compliant ? 'info' : 'warning',
        JSON.stringify({ source: result.source }));

  res.json(result);
});

module.exports = router;
