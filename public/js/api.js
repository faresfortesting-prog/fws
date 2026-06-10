// ── Lightweight API client (token in localStorage + httpOnly cookie) ──
const API = {
  token: localStorage.getItem('ss_token') || null,
  setToken(t) { this.token = t; if (t) localStorage.setItem('ss_token', t); else localStorage.removeItem('ss_token'); },

  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    const res = await fetch(path, {
      method, headers, credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('json') ? await res.json() : await res.text();
    if (!res.ok) throw new Error((data && data.error) || ('Request failed (' + res.status + ')'));
    return data;
  },
  get(p) { return this.request('GET', p); },
  post(p, b) { return this.request('POST', p, b); },
  patch(p, b) { return this.request('PATCH', p, b); },
  del(p) { return this.request('DELETE', p); },
};

// ── Shared UI helpers ──
function toast(msg, kind) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'toast show' + (kind ? ' ' + kind : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3200);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

async function logout() {
  try { await API.post('/auth/logout'); } catch {}
  API.setToken(null);
  location.href = '/';
}

// Redirect to login if not authenticated; returns the current user.
async function requireUser(roles) {
  try {
    const { user } = await API.get('/me');
    if (roles && !roles.includes(user.role)) {
      location.href = user.role === 'instructor' ? '/instructor.html'
        : user.role === 'admin' ? '/admin.html' : '/student.html';
      return null;
    }
    return user;
  } catch {
    location.href = '/';
    return null;
  }
}
