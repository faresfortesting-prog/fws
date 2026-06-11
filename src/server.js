// ════════════════════════════════════════════════════════════════
//  StudyStrike — application server (Express + SQLite)
// ════════════════════════════════════════════════════════════════
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { migrate } = require('./db');

// Ensure tables exist on boot.
migrate();

const app = express();
app.use(express.json({ limit: '8mb' })); // 8mb allows base64 frames for AI checks
app.use(cookieParser());

// ── API routes ──
const authRouter = require('./routes/auth');
app.use('/auth', authRouter);
app.use('/', authRouter);                            // also exposes GET /me at root
app.use('/instructor', require('./routes/instructor'));
app.use('/classes', require('./routes/classes'));
app.use('/tasks', require('./routes/tasks'));
app.use('/students', require('./routes/students'));
app.use('/study-sessions', require('./routes/studySessions'));
app.use('/verification-events', require('./routes/verification'));
app.use('/', require('./routes/social'));            // /announcements, /messages
app.use('/reports', require('./routes/reports'));
app.use('/points', require('./routes/reports'));     // /points/adjust, /points/audit
app.use('/admin', require('./routes/admin'));

app.get('/api/health', (_req, res) => res.json({ ok: true, env: config.nodeEnv }));

// ── Static frontend ──
app.use(express.static(path.join(__dirname, '..', 'public')));

// Central error handler — never leak stack traces in production.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: config.isProd ? 'Internal server error' : String(err.message) });
});

app.listen(config.port, () => {
  console.log(`StudyStrike running → http://localhost:${config.port}  (${config.nodeEnv})`);
});

// ── Auto-refresh: periodically re-sync every saved Blackboard feed ──
if (config.blackboardAutoSync) {
  const { syncAll } = require('./services/blackboard');
  const INTERVAL = config.blackboardSyncHours * 3600 * 1000;
  const run = () => syncAll()
    .then(r => { if (r.imported) console.log(`Blackboard auto-sync: +${r.imported} deadline(s) across ${r.students} student(s)`); })
    .catch(() => {});
  setTimeout(run, 30 * 1000);          // first run shortly after boot
  setInterval(run, INTERVAL);          // then on a fixed interval
}
