// ── Seed data: demo admin, instructor, students, courses, classes, tasks ──
// Mirrors the original prototype's demo accounts. In production set
// SEED_DEMO_DATA=false to skip seeding demo credentials.
const { db, migrate } = require('./index');
const config = require('../config');
const { hashPassword } = require('../utils/auth');
const { ensurePermissions } = require('../utils/helpers');

migrate();

if (!config.seedDemoData) {
  console.log('SEED_DEMO_DATA=false → skipping demo seed.');
  process.exit(0);
}

const seed = db.transaction(() => {
  // Idempotent-ish: wipe demo rows by clearing tables (dev only).
  db.exec(`DELETE FROM users; DELETE FROM courses; DELETE FROM classes;
           DELETE FROM tasks; DELETE FROM class_enrollments;
           DELETE FROM student_profiles; DELETE FROM instructor_profiles;
           DELETE FROM instructor_permissions; DELETE FROM announcements;
           DELETE FROM student_task_progress; DELETE FROM study_sessions;
           DELETE FROM verification_events; DELETE FROM messages;
           DELETE FROM points_audit; DELETE FROM audit_logs;`);

  const insUser = db.prepare(
    'INSERT INTO users (full_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)'
  );

  // Admin
  const adminId = insUser.run('System Admin', 'admin@studystrike.io', hashPassword('admin123'), 'admin', 'active').lastInsertRowid;

  // Instructor (demo)
  const instrId = insUser.run('Dr. Olivia Bennett', 'instructor@studystrike.io', hashPassword('admin123'), 'instructor', 'active').lastInsertRowid;
  db.prepare('INSERT INTO instructor_profiles (user_id, department, title, office_hours, bio) VALUES (?, ?, ?, ?, ?)')
    .run(instrId, 'Computer Science', 'Associate Professor', 'Mon/Wed 2-4pm', 'Teaches intro programming and algorithms.');

  // Students (demo)
  const students = [
    ['Alex Nguyen', 'student@cs101', 'Computer Science', 1, 320, 6],
    ['Sarah Al-Rashidi', 'student@math401', 'Mathematics', 4, 540, 9],
    ['Carlos Mendez', 'student@chem301', 'Chemistry', 3, 410, 4],
    ['Jordan Smith', 'jordan@studystrike.io', 'Computer Science', 2, 280, 3],
    ['Morgan Lee', 'morgan@studystrike.io', 'Computer Science', 2, 460, 7],
  ];
  const studentIds = students.map(([name, email, major, yr, pts, streak]) => {
    const id = insUser.run(name, email, hashPassword('pass123'), 'student', 'active').lastInsertRowid;
    db.prepare(`INSERT INTO student_profiles
      (user_id, student_number, major, year_level, daily_study_goal, total_points, current_streak, last_active_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
      .run(id, 'S' + (100000 + id), major, 'Year ' + yr, 120, pts, streak);
    return id;
  });

  // Courses
  const insCourse = db.prepare(
    'INSERT INTO courses (course_code, course_name, description, semester, created_by_instructor_id) VALUES (?, ?, ?, ?, ?)'
  );
  const cs101 = insCourse.run('CS101', 'Intro to Programming', 'Fundamentals of programming.', 'Fall 2026', instrId).lastInsertRowid;
  const math401 = insCourse.run('MATH401', 'Advanced Calculus', 'Series, sequences, integration.', 'Fall 2026', instrId).lastInsertRowid;

  // Classes
  const insClass = db.prepare(
    'INSERT INTO classes (course_id, instructor_id, class_name, join_code, status) VALUES (?, ?, ?, ?, ?)'
  );
  const csClass = insClass.run(cs101, instrId, 'CS 101 — Section A', 'SS-CS101A', 'active').lastInsertRowid;
  const mathClass = insClass.run(math401, instrId, 'MATH 401 — Section A', 'SS-MTH401', 'active').lastInsertRowid;
  ensurePermissions(instrId, csClass);
  ensurePermissions(instrId, mathClass);

  // Enrollments — first three students in CS, plus Sarah in MATH
  const enroll = db.prepare("INSERT INTO class_enrollments (class_id, student_id, enrollment_status) VALUES (?, ?, 'active')");
  [studentIds[0], studentIds[3], studentIds[4]].forEach(sid => enroll.run(csClass, sid));
  enroll.run(mathClass, studentIds[1]);
  enroll.run(csClass, studentIds[2]);

  // Tasks
  const insTask = db.prepare(
    `INSERT INTO tasks (class_id, course_id, instructor_id, title, description, task_type, points, estimated_time, due_date, urgency, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now', ?), ?, 'published')`
  );
  const csTasks = [
    ['Coding Lab 2', 'lab', 120, '2h', '+0 days', 'critical'],
    ['Algorithm Analysis HW', 'assignment', 90, '1h', '+2 days', 'high'],
    ['Mini-Project: Binary Trees', 'project', 200, '4h', '+7 days', 'medium'],
    ['Quiz: Loops & Functions', 'quiz', 50, '25 min', '+4 days', 'medium'],
  ];
  const csTaskIds = csTasks.map(([t, ty, p, e, d, u]) =>
    insTask.run(csClass, cs101, instrId, t, t + ' — see brief.', ty, p, e, d, u).lastInsertRowid);

  insTask.run(mathClass, math401, instrId, 'Problem Set 3', 'Integration practice.', 'assignment', 100, '1.5h', '+1 days', 'high');
  insTask.run(mathClass, math401, instrId, 'Weekly Quiz 4', 'Series & sequences.', 'quiz', 50, '30 min', '+3 days', 'medium');

  // Some student progress + a sample session
  db.prepare("INSERT INTO student_task_progress (student_id, task_id, progress_percent, status, points_earned) VALUES (?, ?, 100, 'completed', 120)")
    .run(studentIds[0], csTaskIds[0]);
  db.prepare("INSERT INTO student_task_progress (student_id, task_id, progress_percent, status, points_earned) VALUES (?, ?, 40, 'in_progress', 36)")
    .run(studentIds[0], csTaskIds[1]);

  const sess = db.prepare(`INSERT INTO study_sessions
    (student_id, task_id, class_id, started_at, ended_at, planned_minutes, actual_focus_minutes, away_minutes, focus_percentage, points_earned, webcam_enabled, screen_share_enabled, verification_status)
    VALUES (?, ?, ?, datetime('now','-2 hours'), datetime('now','-1 hours'), 60, 52, 8, 87, 120, 1, 1, 'verified')`)
    .run(studentIds[0], csTaskIds[0], csClass).lastInsertRowid;
  db.prepare("INSERT INTO verification_events (study_session_id, event_type, reason, severity) VALUES (?, 'face_missing', 'No face detected for 20s', 'warning')").run(sess);
  db.prepare("INSERT INTO verification_events (study_session_id, event_type, reason, severity) VALUES (?, 'screen_off_task', 'Social media tab detected', 'warning')").run(sess);

  // Announcement
  db.prepare("INSERT INTO announcements (class_id, instructor_id, title, message, pinned) VALUES (?, ?, ?, ?, 1)")
    .run(csClass, instrId, 'Welcome to CS 101!', 'Lab 2 is due this week. Log study sessions to earn points.');
});

seed();

console.log('✓ Seed complete.');
console.log('  Admin:      admin@studystrike.io / admin123');
console.log('  Instructor: instructor@studystrike.io / admin123');
console.log('  Students:   student@cs101 / student@math401 / student@chem301 (pass123)');
console.log('  Demo class codes: SS-CS101A, SS-MTH401');
process.exit(0);
