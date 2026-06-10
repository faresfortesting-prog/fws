// ── Verification events route (privacy-safe; summaries only, never raw media) ──
const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// POST /verification-events — log a privacy-safe focus event
router.post('/', requireRole('student', 'admin'), (req, res) => {
  const { study_session_id, event_type, reason, severity, metadata } = req.body || {};
  const session = db.prepare('SELECT * FROM study_sessions WHERE id = ?').get(study_session_id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (req.user.role === 'student' && session.student_id !== req.user.id)
    return res.status(403).json({ error: 'Not your session' });

  const valid = ['face_detected', 'face_missing', 'screen_ok', 'screen_off_task', 'screen_disconnected'];
  if (!valid.includes(event_type)) return res.status(400).json({ error: 'Invalid event_type' });

  // Strip any media fields — we only ever persist a small JSON summary.
  let metaStr = null;
  if (metadata && typeof metadata === 'object') {
    const { image, frame, video, ...safe } = metadata;
    metaStr = JSON.stringify(safe);
  }
  const info = db.prepare(
    `INSERT INTO verification_events (study_session_id, event_type, reason, severity, metadata)
     VALUES (?, ?, ?, ?, ?)`
  ).run(study_session_id, event_type, reason || null, severity || 'info', metaStr);
  res.status(201).json(db.prepare('SELECT * FROM verification_events WHERE id = ?').get(info.lastInsertRowid));
});

module.exports = router;
