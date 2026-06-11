// ── Blackboard sync service ──
// Core fetch → parse → group-by-subject → upsert logic, shared by the manual
// import route and the automatic refresh scheduler.
const { db } = require('../db');
const { parseICS } = require('../utils/ics');
const { audit } = require('../utils/helpers');

// Shared system instructor + course used for all imported deadlines.
function ensureBlackboardSystem() {
  let inst = db.prepare("SELECT id FROM users WHERE email = 'blackboard-sync@studystrike.io'").get();
  if (!inst) {
    const info = db.prepare(
      "INSERT INTO users (full_name, email, password_hash, role, status) VALUES ('Blackboard Sync', 'blackboard-sync@studystrike.io', 'x', 'instructor', 'active')"
    ).run();
    inst = { id: info.lastInsertRowid };
    db.prepare('INSERT INTO instructor_profiles (user_id, department) VALUES (?, ?)').run(inst.id, 'Integrations');
  }
  return inst.id;
}

function slug(s) {
  return (s || 'general').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12) || 'GENERAL';
}

// One class per subject, per student.
function ensureCourseClass(studentId, instructorId, courseLabel) {
  const label = courseLabel || 'Other Blackboard Deadlines';
  const code = 'BB-' + studentId + '-' + slug(label);
  let course = db.prepare('SELECT id FROM courses WHERE created_by_instructor_id = ? AND course_name = ?')
    .get(instructorId, label);
  if (!course) {
    const info = db.prepare(
      "INSERT INTO courses (course_code, course_name, description, created_by_instructor_id) VALUES (?, ?, 'Imported from Blackboard.', ?)"
    ).run(slug(label), label, instructorId);
    course = { id: info.lastInsertRowid };
  }
  let cls = db.prepare('SELECT id FROM classes WHERE join_code = ?').get(code);
  if (!cls) {
    const info = db.prepare(
      "INSERT INTO classes (course_id, instructor_id, class_name, join_code, status) VALUES (?, ?, ?, ?, 'active')"
    ).run(course.id, instructorId, label, code);
    cls = { id: info.lastInsertRowid };
  }
  if (!db.prepare('SELECT 1 FROM class_enrollments WHERE class_id = ? AND student_id = ?').get(cls.id, studentId)) {
    db.prepare("INSERT INTO class_enrollments (class_id, student_id, enrollment_status) VALUES (?, ?, 'active')").run(cls.id, studentId);
  }
  return { classId: cls.id, courseId: course.id };
}

// Fetch + import one student's feed. Returns {imported, total, subjects} or throws.
async function syncStudent(studentId, url) {
  if (!/^https?:\/\//i.test(url)) throw new Error('Invalid calendar URL');
  const resp = await fetch(url, { headers: { 'User-Agent': 'StudyStrike/1.0' } });
  if (!resp.ok) throw new Error(`Blackboard returned HTTP ${resp.status}`);
  const raw = await resp.text();
  if (!/BEGIN:VCALENDAR/i.test(raw)) throw new Error('Not a valid calendar feed');

  const events = parseICS(raw).filter(e => e.due_date);
  const instructorId = ensureBlackboardSystem();
  const findTask = db.prepare("SELECT id FROM tasks WHERE class_id = ? AND title = ? AND IFNULL(due_date,'') = ?");
  const insTask = db.prepare(
    `INSERT INTO tasks (class_id, course_id, instructor_id, title, description, task_type, points, due_date, urgency, status)
     VALUES (?, ?, ?, ?, ?, ?, 100, ?, ?, 'published')`
  );
  let imported = 0;
  const subjects = new Set();
  const cache = {};
  db.transaction(() => {
    for (const e of events) {
      const key = e.course || 'Other Blackboard Deadlines';
      subjects.add(key);
      if (!cache[key]) cache[key] = ensureCourseClass(studentId, instructorId, e.course);
      const { classId, courseId } = cache[key];
      if (findTask.get(classId, e.title, e.due_date)) continue;
      insTask.run(classId, courseId, instructorId, e.title, e.description || null, e.task_type, e.due_date, e.urgency);
      imported++;
    }
    db.prepare("UPDATE student_profiles SET blackboard_ics_url = ?, blackboard_last_sync = datetime('now') WHERE user_id = ?")
      .run(url, studentId);
  })();
  return { imported, total: events.length, subjects: [...subjects] };
}

// Re-sync every student who has a saved feed. Called by the scheduler.
async function syncAll() {
  const rows = db.prepare("SELECT user_id, blackboard_ics_url FROM student_profiles WHERE blackboard_ics_url IS NOT NULL AND blackboard_ics_url <> ''").all();
  let totalImported = 0;
  for (const r of rows) {
    try {
      const { imported } = await syncStudent(r.user_id, r.blackboard_ics_url);
      totalImported += imported;
      if (imported > 0) audit(null, 'blackboard_auto_sync', 'user', r.user_id, { imported });
    } catch { /* skip a failing feed, keep going */ }
  }
  return { students: rows.length, imported: totalImported };
}

module.exports = { syncStudent, syncAll, ensureBlackboardSystem, ensureCourseClass };
