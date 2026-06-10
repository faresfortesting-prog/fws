// ── Auth routes: register, login, logout, me ──
const express = require('express');
const { db } = require('../db');
const { hashPassword, verifyPassword, signToken } = require('../utils/auth');
const { isEmail, nonEmpty, audit } = require('../utils/helpers');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 };

// POST /auth/register  — create a student or instructor account
router.post('/register', (req, res) => {
  const { full_name, email, password, role } = req.body || {};
  if (!nonEmpty(full_name)) return res.status(400).json({ error: 'Full name is required' });
  if (!isEmail(email)) return res.status(400).json({ error: 'A valid email is required' });
  if (!nonEmpty(password) || password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  // Self-registration is limited to student/instructor. Admins are created by seed/admins.
  const safeRole = role === 'instructor' ? 'instructor' : 'student';

  const normEmail = email.trim().toLowerCase();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(normEmail))
    return res.status(409).json({ error: 'An account with this email already exists' });

  const info = db.prepare(
    `INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)`
  ).run(full_name.trim(), normEmail, hashPassword(password), safeRole);
  const userId = info.lastInsertRowid;

  if (safeRole === 'student') {
    db.prepare('INSERT INTO student_profiles (user_id, student_number) VALUES (?, ?)')
      .run(userId, 'S' + String(100000 + userId));
  } else {
    db.prepare('INSERT INTO instructor_profiles (user_id) VALUES (?)').run(userId);
  }

  const user = db.prepare('SELECT id, full_name, email, role, status FROM users WHERE id = ?').get(userId);
  const token = signToken(user);
  audit(userId, 'register', 'user', userId, { role: safeRole });
  res.cookie('token', token, COOKIE_OPTS).status(201).json({ token, user });
});

// POST /auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  // Login accepts any non-empty identifier (demo accounts use usernames like
  // "student@cs101"); registration still enforces a strict email format.
  if (!nonEmpty(email) || !nonEmpty(password))
    return res.status(400).json({ error: 'Email and password are required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !verifyPassword(password, user.password_hash))
    return res.status(401).json({ error: 'Incorrect email or password' });
  if (user.status === 'suspended')
    return res.status(403).json({ error: 'This account has been suspended' });

  const safe = { id: user.id, full_name: user.full_name, email: user.email, role: user.role, status: user.status };
  const token = signToken(safe);
  if (user.role === 'student') {
    db.prepare("UPDATE student_profiles SET last_active_at = datetime('now') WHERE user_id = ?").run(user.id);
  }
  res.cookie('token', token, COOKIE_OPTS).json({ token, user: safe });
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token').json({ ok: true });
});

// GET /me — current user + profile
router.get('/me', requireAuth, (req, res) => {
  const user = req.user;
  let profile = null;
  if (user.role === 'student') {
    profile = db.prepare('SELECT * FROM student_profiles WHERE user_id = ?').get(user.id);
  } else if (user.role === 'instructor') {
    profile = db.prepare('SELECT * FROM instructor_profiles WHERE user_id = ?').get(user.id);
  }
  res.json({ user, profile });
});

module.exports = router;
