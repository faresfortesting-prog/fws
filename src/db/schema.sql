-- ════════════════════════════════════════════════════════════════
--  StudyStrike — database schema (SQLite)
--  All instructor/student/class data is persisted here (no in-memory DB).
-- ════════════════════════════════════════════════════════════════

PRAGMA foreign_keys = ON;

-- ── Users: every account (student, instructor, admin) ──
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name     TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('student','instructor','admin')),
  avatar_url    TEXT,
  status        TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','pending')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── StudentProfiles: extra fields for student users ──
CREATE TABLE IF NOT EXISTS student_profiles (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  student_number   TEXT,
  major            TEXT,
  year_level       TEXT,
  daily_study_goal INTEGER NOT NULL DEFAULT 120,  -- minutes/day
  total_points     INTEGER NOT NULL DEFAULT 0,
  current_streak   INTEGER NOT NULL DEFAULT 0,
  last_active_at   TEXT,
  blackboard_ics_url TEXT,
  blackboard_last_sync TEXT
);

-- ── InstructorProfiles: extra fields for instructor users ──
CREATE TABLE IF NOT EXISTS instructor_profiles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  department   TEXT,
  title        TEXT,
  office_hours TEXT,
  bio          TEXT
);

-- ── Courses ──
CREATE TABLE IF NOT EXISTS courses (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  course_code              TEXT NOT NULL,
  course_name              TEXT NOT NULL,
  description              TEXT,
  semester                 TEXT,
  created_by_instructor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status                   TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Classes (a concrete offering of a course by an instructor) ──
CREATE TABLE IF NOT EXISTS classes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id     INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_name    TEXT NOT NULL,
  join_code     TEXT NOT NULL UNIQUE,            -- all class codes are unique
  approval_mode INTEGER NOT NULL DEFAULT 0,      -- 1 = instructor must approve joins
  start_date    TEXT,
  end_date      TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── ClassEnrollments (students <-> classes, many-to-many) ──
CREATE TABLE IF NOT EXISTS class_enrollments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id          INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrollment_status TEXT NOT NULL DEFAULT 'active' CHECK (enrollment_status IN ('active','pending','removed')),
  joined_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (class_id, student_id)
);

-- ── Tasks (instructor-created work items) ──
CREATE TABLE IF NOT EXISTS tasks (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id       INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  course_id      INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  instructor_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  task_type      TEXT NOT NULL DEFAULT 'assignment'
                 CHECK (task_type IN ('assignment','quiz','lab','project','exam','essay','reading','custom')),
  points         INTEGER NOT NULL DEFAULT 100,
  estimated_time TEXT,
  due_date       TEXT,
  urgency        TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('critical','high','medium','low')),
  status         TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── StudentTaskProgress (per-student, per-task progress) ──
CREATE TABLE IF NOT EXISTS student_task_progress (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id          INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  points_earned    INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'not_started'
                   CHECK (status IN ('not_started','in_progress','completed','overdue')),
  submitted_at     TEXT,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, task_id)
);

-- ── StudySessions (a logged focus session) ──
CREATE TABLE IF NOT EXISTS study_sessions (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id              INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  class_id             INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  started_at           TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at             TEXT,
  planned_minutes      INTEGER NOT NULL DEFAULT 0,
  actual_focus_minutes REAL NOT NULL DEFAULT 0,
  away_minutes         REAL NOT NULL DEFAULT 0,
  focus_percentage     INTEGER NOT NULL DEFAULT 0,
  points_earned        INTEGER NOT NULL DEFAULT 0,
  webcam_enabled       INTEGER NOT NULL DEFAULT 0,
  screen_share_enabled INTEGER NOT NULL DEFAULT 0,
  verification_status  TEXT NOT NULL DEFAULT 'pending'
                       CHECK (verification_status IN ('pending','verified','flagged','unverified'))
);

-- ── VerificationEvents (privacy-safe focus monitor events — NO raw video) ──
CREATE TABLE IF NOT EXISTS verification_events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  study_session_id INTEGER NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL CHECK (event_type IN
                     ('face_detected','face_missing','screen_ok','screen_off_task','screen_disconnected')),
  event_time       TEXT NOT NULL DEFAULT (datetime('now')),
  reason           TEXT,
  severity         TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  metadata         TEXT   -- JSON string, summary only (never image/video data)
);

-- ── Announcements ──
CREATE TABLE IF NOT EXISTS announcements (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id      INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  pinned        INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Messages (direct + class-wide) ──
CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,  -- NULL = whole class
  class_id    INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  subject     TEXT,
  body        TEXT NOT NULL,
  read_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── InstructorPermissions (per instructor, per class — enforced on backend) ──
CREATE TABLE IF NOT EXISTS instructor_permissions (
  id                         INTEGER PRIMARY KEY AUTOINCREMENT,
  instructor_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id                   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  can_view_student_profiles  INTEGER NOT NULL DEFAULT 1,
  can_view_leaderboard       INTEGER NOT NULL DEFAULT 1,
  can_view_study_sessions    INTEGER NOT NULL DEFAULT 1,
  can_view_verification_events INTEGER NOT NULL DEFAULT 1,
  can_create_tasks           INTEGER NOT NULL DEFAULT 1,
  can_edit_tasks             INTEGER NOT NULL DEFAULT 1,
  can_delete_tasks           INTEGER NOT NULL DEFAULT 1,
  can_award_points           INTEGER NOT NULL DEFAULT 1,
  can_send_announcements     INTEGER NOT NULL DEFAULT 1,
  can_message_students       INTEGER NOT NULL DEFAULT 1,
  can_export_reports         INTEGER NOT NULL DEFAULT 1,
  UNIQUE (instructor_id, class_id)
);

-- ── PointsAudit (traceable log of every points change) ──
CREATE TABLE IF NOT EXISTS points_audit (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  task_id     INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  delta       INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── AuditLogs (sensitive instructor/admin actions) ──
CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   INTEGER,
  detail      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Helpful indexes ──
CREATE INDEX IF NOT EXISTS idx_enroll_class   ON class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_enroll_student ON class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_tasks_class    ON tasks(class_id);
CREATE INDEX IF NOT EXISTS idx_progress_student ON student_task_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_student ON study_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_vevents_session ON verification_events(study_session_id);
CREATE INDEX IF NOT EXISTS idx_classes_instructor ON classes(instructor_id);
