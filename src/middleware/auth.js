// ── Authentication & role-based-access-control middleware ──
const { verifyToken } = require('../utils/auth');
const { db } = require('../db');

// Populates req.user from a JWT in the Authorization header or the auth cookie.
// Rejects with 401 if missing/invalid, or if the account is not active.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = bearer || (req.cookies && req.cookies.token);
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired session' });

  const user = db.prepare('SELECT id, full_name, email, role, status, avatar_url FROM users WHERE id = ?')
    .get(payload.id);
  if (!user) return res.status(401).json({ error: 'Account not found' });
  if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended' });

  req.user = user;
  next();
}

// Restrict a route to one or more roles. Use after requireAuth.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions for this role' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
