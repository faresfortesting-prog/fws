// ════ Student dashboard logic ════
let ME = null, MY_CLASSES = [], MY_TASKS = [];

async function boot() {
  ME = await requireUser(['student']);
  if (!ME) return;
  document.getElementById('sideName').textContent = ME.full_name;
  document.getElementById('sideEmail').textContent = ME.email;
  setupNav();
  await Promise.all([loadProfile(), loadClasses(), loadTasks(), loadMessages()]);
  prefillBlackboard();
  showView('overview');
}

function setupNav() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));
  document.getElementById(name).classList.add('active');
  document.getElementById('pageTitle').textContent =
    { overview: 'Overview', leaderboard: 'Leaderboard', tasks: 'Task Progress',
      classes: 'My Classes', feedback: 'Instructor Feedback', messages: 'Messages', privacy: 'Privacy' }[name];
  document.getElementById('sidebar').classList.remove('open');
  if (name === 'overview') loadOverview();
  if (name === 'leaderboard') loadLeaderboard();
  if (name === 'feedback') loadFeedback();
  if (name === 'privacy') loadMyEvents();
}

async function loadProfile() {
  const { profile } = await API.get('/me');
  document.getElementById('tpStreak').textContent = '🔥 ' + (profile?.current_streak || 0);
  document.getElementById('tpPoints').textContent = '⭐ ' + (profile?.total_points || 0).toLocaleString();
  window.MY_PROFILE = profile;
}

async function loadClasses() {
  MY_CLASSES = await API.get('/students/me/classes');
  // Populate class selectors
  const lbSel = document.getElementById('lbClass');
  const msgSel = document.getElementById('msgClass');
  const opts = MY_CLASSES.filter(c => c.enrollment_status === 'active')
    .map(c => `<option value="${c.id}">${esc(c.class_name)}</option>`).join('');
  lbSel.innerHTML = opts || '<option value="">No classes yet</option>';
  msgSel.innerHTML = opts || '<option value="">No classes yet</option>';

  const list = document.getElementById('classList');
  if (!MY_CLASSES.length) { list.innerHTML = emptyState('🎓', 'No classes yet', 'Join a class with a code from your instructor.'); return; }
  list.innerHTML = MY_CLASSES.map(c => `
    <div class="card">
      <div class="card-head">
        <div><div class="sec-title">${esc(c.class_name)}</div>
          <div style="font-size:12.5px;color:var(--muted)">${esc(c.course_code || '')} · ${esc(c.instructor_name)}</div></div>
        <span class="pill ${c.enrollment_status === 'active' ? 'pill-green' : 'pill-amber'}">${c.enrollment_status}</span>
      </div>
    </div>`).join('');
}

async function loadTasks() {
  MY_TASKS = await API.get('/students/me/tasks');
  const sel = document.getElementById('sessTask');
  sel.innerHTML = MY_TASKS.map(t => `<option value="${t.id}">${esc(t.title)} (${esc(t.class_name)})</option>`).join('')
    || '<option value="">No tasks — join a class first</option>';

  const list = document.getElementById('taskList');
  if (!MY_TASKS.length) { list.innerHTML = emptyState('📋', 'No tasks yet', 'Tasks created by your instructors will appear here.'); return; }
  list.innerHTML = MY_TASKS.map(t => {
    const due = t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No due date';
    const urgClass = 'urg-' + (t.urgency || 'low');
    const statusPill = t.my_status === 'completed' ? 'pill-green' : t.overdue ? 'pill-red' : t.my_status === 'in_progress' ? 'pill-amber' : 'pill-grey';
    return `<div class="task-card ${urgClass} ${t.overdue ? 'overdue' : ''}">
      <div class="task-top">
        <div><div class="task-title">${esc(t.title)}</div><div class="task-course">${esc(t.class_name)} · ${esc(t.task_type)}</div></div>
        <span class="pill ${statusPill}">${t.overdue ? 'overdue' : esc(t.my_status.replace('_', ' '))}</span>
      </div>
      <div class="prog-bar"><div class="prog-fill" style="width:${t.progress_percent}%"></div></div>
      <div class="task-meta">
        <span>⏱️ ${esc(t.estimated_time || '—')}</span><span>📅 Due ${esc(due)}</span><span>⭐ ${t.points} pts</span><span>${t.progress_percent}% done</span>
      </div>
    </div>`;
  }).join('');
}

async function loadOverview() {
  const p = window.MY_PROFILE || {};
  const completed = MY_TASKS.filter(t => t.my_status === 'completed').length;
  document.getElementById('ovKpis').innerHTML = `
    ${kpi('Total Points', (p.total_points || 0).toLocaleString(), 'this semester')}
    ${kpi('Current Streak', '🔥 ' + (p.current_streak || 0), 'days in a row')}
    ${kpi('Active Classes', MY_CLASSES.filter(c => c.enrollment_status === 'active').length, 'enrolled')}
    ${kpi('Tasks Completed', completed + ' / ' + MY_TASKS.length, 'across all classes')}`;
  try {
    const anns = await API.get('/announcements');
    const pinned = anns.filter(a => a.pinned);
    document.getElementById('ovAnns').innerHTML = (pinned.length ? pinned : anns).slice(0, 3)
      .map(a => annCard(a)).join('') || '<div class="empty">No announcements.</div>';
  } catch { document.getElementById('ovAnns').innerHTML = '<div class="empty">No announcements.</div>'; }
  try {
    const sess = await API.get('/students/' + ME.id + '/sessions');
    document.getElementById('ovSessions').innerHTML = sess.length ? `<table><tr><th>Task</th><th>Focus %</th><th>Points</th><th>When</th></tr>` +
      sess.slice(0, 5).map(s => `<tr><td>${esc(s.task_title || '—')}</td><td>${s.focus_percentage}%</td><td>${s.points_earned}</td><td>${new Date(s.started_at).toLocaleString()}</td></tr>`).join('') + '</table>'
      : '<div class="empty">No sessions logged yet.</div>';
  } catch {}
}

async function loadLeaderboard() {
  const cid = document.getElementById('lbClass').value;
  const list = document.getElementById('lbList');
  if (!cid) { list.innerHTML = emptyState('🏆', 'No class selected', 'Join a class to see its leaderboard.'); return; }
  list.innerHTML = '<div class="loading">Loading…</div>';
  try {
    const rows = await API.get('/classes/' + cid + '/leaderboard');
    list.innerHTML = rows.map(r => {
      const medal = ['🥇', '🥈', '🥉'][r.rank - 1] || '#' + r.rank;
      const me = r.id === ME.id;
      return `<div class="lb-row ${me ? 'me' : ''}">
        <div class="lb-rank">${medal}</div>
        <div class="lb-avatar">${initials(r.name)}</div>
        <div class="lb-info"><div class="lb-name">${esc(r.name)}${me ? ' (You)' : ''}</div>
          <div class="lb-streak">🔥 ${r.streak}-day streak</div></div>
        <div class="lb-pts">${(r.points || 0).toLocaleString()}<div style="font-size:11px;color:var(--muted)">points</div></div>
      </div>`;
    }).join('') || emptyState('🏆', 'Empty leaderboard', 'No active students yet.');
  } catch (e) { list.innerHTML = `<div class="error-banner">${esc(e.message)}</div>`; }
}

async function loadFeedback() {
  const list = document.getElementById('feedbackList');
  try {
    const anns = await API.get('/announcements');
    list.innerHTML = anns.length ? anns.map(a => annCard(a)).join('')
      : emptyState('💬', 'No feedback yet', 'Instructor announcements and feedback show here.');
  } catch (e) { list.innerHTML = `<div class="error-banner">${esc(e.message)}</div>`; }
}

async function loadMessages() {
  try {
    const { messages, unread } = await API.get('/messages');
    const badge = document.getElementById('msgBadge');
    badge.textContent = unread; badge.classList.toggle('hidden', !unread);
    document.getElementById('msgList').innerHTML = messages.length
      ? messages.map(m => `<div class="card"><div style="font-weight:700">${esc(m.sender_name)}</div>
          <div style="font-size:13px;margin:.3rem 0">${esc(m.body)}</div>
          <div style="font-size:11px;color:var(--muted)">${new Date(m.created_at).toLocaleString()}</div></div>`).join('')
      : emptyState('✉️', 'No messages', 'Messages with your instructors appear here.');
  } catch {}
}

async function loadMyEvents() {
  try {
    const sess = await API.get('/students/' + ME.id + '/sessions');
    const el = document.getElementById('myEvents');
    el.innerHTML = sess.length ? `<table><tr><th>Session</th><th>Focus %</th><th>Status</th><th>When</th></tr>` +
      sess.map(s => `<tr><td>${esc(s.task_title || '—')}</td><td>${s.focus_percentage}%</td>
        <td><span class="pill ${s.verification_status === 'verified' ? 'pill-green' : 'pill-amber'}">${s.verification_status}</span></td>
        <td>${new Date(s.started_at).toLocaleString()}</td></tr>`).join('') + '</table>'
      : '<div class="empty">No verification history yet.</div>';
  } catch {}
}

// ── Actions ──
async function joinClass() {
  const code = document.getElementById('joinCode').value.trim().toUpperCase();
  if (!code) return;
  try {
    const r = await API.post('/students/join-class', { code });
    toast('Joined ' + r.class.class_name + (r.enrollment_status === 'pending' ? ' (pending approval)' : ''), 'success');
    document.getElementById('joinCode').value = '';
    await Promise.all([loadClasses(), loadTasks()]);
  } catch (e) { toast(e.message, 'error'); }
}

async function importBlackboard() {
  const url = document.getElementById('bbUrl').value.trim();
  if (!url) return toast('Paste your Blackboard .ics link first', 'error');
  const btn = document.getElementById('bbBtn');
  btn.disabled = true; btn.textContent = 'Importing…';
  try {
    const r = await API.post('/students/import-blackboard', { ics_url: url });
    toast(`Imported ${r.imported} deadline${r.imported === 1 ? '' : 's'} from Blackboard`, 'success');
    await Promise.all([loadClasses(), loadTasks()]);
    showView('tasks');
  } catch (e) { toast(e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Import deadlines'; }
}

// Prefill the Blackboard field and auto-sync deadlines in the background on login,
// so imported deadlines appear directly without the student clicking anything.
async function prefillBlackboard() {
  try {
    const { ics_url } = await API.get('/students/me/blackboard-url');
    if (!ics_url) return;
    document.getElementById('bbUrl').value = ics_url;
    // Silent background refresh.
    const r = await API.post('/students/import-blackboard', { ics_url });
    if (r.imported > 0) {
      toast(`Synced ${r.imported} new deadline${r.imported === 1 ? '' : 's'} from Blackboard`, 'success');
      await Promise.all([loadClasses(), loadTasks()]);
      loadOverview();
    }
  } catch { /* offline or feed unreachable — stay silent */ }
}

async function sendMessage() {
  const class_id = document.getElementById('msgClass').value;
  const body = document.getElementById('msgBody').value.trim();
  if (!class_id || !body) return toast('Pick a class and type a message', 'error');
  const cls = MY_CLASSES.find(c => String(c.id) === String(class_id));
  try {
    await API.post('/messages', { class_id, body, subject: 'From student' });
    document.getElementById('msgBody').value = '';
    toast('Message sent', 'success');
    loadMessages();
  } catch (e) { toast(e.message, 'error'); }
}

// ── helpers ──
function kpi(label, value, sub) { return `<div class="kpi-card"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`; }
function annCard(a) { return `<div class="card" style="margin-bottom:.6rem"><div style="display:flex;justify-content:space-between">
  <div class="sec-title" style="font-size:14px">${a.pinned ? '📌 ' : ''}${esc(a.title)}</div>
  <span style="font-size:11px;color:var(--muted)">${esc(a.class_name || '')}</span></div>
  <div style="font-size:13px;margin-top:.4rem">${esc(a.message)}</div>
  <div style="font-size:11px;color:var(--muted);margin-top:.4rem">${esc(a.instructor_name || '')} · ${new Date(a.created_at).toLocaleDateString()}</div></div>`; }
function emptyState(ico, h, p) { return `<div class="empty"><div class="ico">${ico}</div><h3>${h}</h3><p>${p}</p></div>`; }

// ════ FOCUS SESSION ════ (see focus.js logic below)
function openLog() {
  if (!MY_TASKS.length) return toast('Join a class with tasks first', 'error');
  document.getElementById('logOverlay').classList.add('open');
}
function closeLog() { document.getElementById('logOverlay').classList.remove('open'); }

// ── Face detection (MediaPipe with skin-tone fallback) ──
let faceDetector = null, faceReady = false, lastFace = true;
async function initFace() {
  try {
    if (typeof FaceDetection !== 'undefined') {
      faceDetector = new FaceDetection({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/${f}` });
      faceDetector.setOptions({ model: 'short', minDetectionConfidence: 0.5 });
      faceDetector.onResults(r => { lastFace = !!(r.detections && r.detections.length); });
      await faceDetector.initialize(); faceReady = true;
    }
  } catch { faceReady = false; }
}
async function detectFace() {
  const v = document.getElementById('camFeed');
  if (!v || !v.videoWidth) return true;
  if (faceReady && faceDetector) { try { await faceDetector.send({ image: v }); return lastFace; } catch { return lastFace; } }
  const c = document.createElement('canvas'); c.width = 40; c.height = 30;
  const ctx = c.getContext('2d'); ctx.drawImage(v, 0, 0, 40, 30);
  const d = ctx.getImageData(0, 0, 40, 30).data; let skin = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) skin++;
  }
  return skin / (d.length / 4) > 0.04;
}

const fm = {};
async function startSession() {
  const taskId = parseInt(document.getElementById('sessTask').value);
  const task = MY_TASKS.find(t => t.id === taskId);
  if (!task) return;
  const mins = parseInt(document.getElementById('sessMins').value);
  const useScreen = document.getElementById('useScreen').checked;
  closeLog();

  Object.assign(fm, {
    task, total: mins * 60, elapsed: 0, present: 0, away: 0, pts: 0,
    isPresent: false, screenActive: !useScreen, useScreen, contentOk: true,
    camReady: false, absentStreak: 0, sessionId: null, stream: null, screenStream: null,
  });
  document.getElementById('fmTask').textContent = task.title;
  ['wFace', 'wScreen', 'wContent'].forEach(id => document.getElementById(id).classList.remove('show'));
  document.getElementById('screenBox').style.display = useScreen ? '' : 'none';
  setPresence('waiting', '⏳', 'Initialising camera…');
  document.getElementById('focusOverlay').classList.add('open');

  // Create the session record on the server.
  try {
    const s = await API.post('/study-sessions', {
      task_id: task.id, class_id: task.class_id, planned_minutes: mins,
      webcam_enabled: 1, screen_share_enabled: useScreen ? 1 : 0,
    });
    fm.sessionId = s.id;
  } catch (e) { toast(e.message, 'error'); }

  initFace();
  await requestCam();
}

async function requestCam() {
  try {
    fm.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 }, audio: false });
    fm.camReady = true; document.getElementById('camFeed').srcObject = fm.stream;
    setPresence('present', '✅', 'Face detected — running'); fm.isPresent = true;
  } catch {
    setPresence('present', '✅', 'Simulation mode — running'); fm.isPresent = true; fm.camReady = false;
  }
  if (fm.useScreen) await requestScreen(); else beginTickers();
}

async function requestScreen() {
  try {
    fm.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    fm.screenActive = true; document.getElementById('screenFeed').srcObject = fm.screenStream;
    fm.screenStream.getVideoTracks()[0].addEventListener('ended', () => {
      fm.screenActive = false; fm.contentOk = false;
      logEvent('screen_disconnected', 'Screen share ended', 'warning');
      document.getElementById('wScreen').classList.add('show');
    });
    startContentChecks();
  } catch {
    fm.useScreen = false; fm.screenActive = true;
    document.getElementById('screenBox').style.display = 'none';
  }
  beginTickers();
}

let contentTimer = null;
function startContentChecks() {
  clearTimeout(contentTimer);
  contentTimer = setTimeout(async function run() {
    if (!fm.useScreen || !fm.screenActive) return;
    await checkContent();
    contentTimer = setTimeout(run, 30000);
  }, 5000);
}
async function checkContent() {
  const v = document.getElementById('screenFeed');
  if (!v || !v.videoWidth) return;
  const c = document.createElement('canvas');
  c.width = Math.min(v.videoWidth, 1280); c.height = Math.min(v.videoHeight, 720);
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
  const frame = c.toDataURL('image/jpeg', 0.6).split(',')[1];
  try {
    // Frame goes to OUR server, which proxies the AI check. Key stays server-side.
    const r = await API.post('/study-sessions/' + fm.sessionId + '/check-screen', { frame_base64: frame, task_title: fm.task.title });
    fm.contentOk = r.compliant;
    const w = document.getElementById('wContent');
    if (r.compliant) { w.classList.remove('show'); }
    else { document.getElementById('wContentText').textContent = 'Off-task: ' + (r.reason || 'non-study content'); w.classList.add('show'); toast('Paused — off-task content', 'error'); }
  } catch { fm.contentOk = true; }
}

function beginTickers() {
  clearInterval(fm.ticker); clearInterval(fm.detect);
  fm.ticker = setInterval(() => {
    if (fm.elapsed >= fm.total) return endSession(false);
    fm.elapsed++;
    const active = fm.isPresent && fm.screenActive && fm.contentOk;
    if (active) { fm.present++; fm.pts += fm.task.points / (fm.total * 0.6); } else fm.away++;
    updateClocks();
  }, 1000);
  fm.detect = setInterval(async () => {
    let detected;
    if (!fm.camReady) detected = Math.random() > 0.1;
    else detected = await detectFace();
    fm.absentStreak = detected ? 0 : fm.absentStreak + 1;
    const present = fm.absentStreak < 2;
    if (present !== fm.isPresent) {
      fm.isPresent = present;
      if (present) { setPresence('present', '✅', 'Face detected — running'); document.getElementById('wFace').classList.remove('show'); logEvent('face_detected', 'Returned to screen', 'info'); }
      else { setPresence('absent', '😶', 'No face — paused'); document.getElementById('wFace').classList.add('show'); logEvent('face_missing', 'No face detected', 'warning'); }
    }
  }, 2500);
}

async function logEvent(type, reason, severity) {
  if (!fm.sessionId) return;
  try { await API.post('/verification-events', { study_session_id: fm.sessionId, event_type: type, reason, severity }); } catch {}
}

function setPresence(state, ico, text) {
  const el = document.getElementById('presence');
  el.className = 'presence ' + state;
  document.getElementById('presIco').textContent = ico;
  document.getElementById('presText').textContent = text;
}
function fmt(s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function updateClocks() {
  document.getElementById('mPresent').textContent = fmt(fm.present);
  document.getElementById('mAway').textContent = fmt(fm.away);
  document.getElementById('mFocus').textContent = fm.elapsed ? Math.round(fm.present / fm.elapsed * 100) + '%' : '—';
  document.getElementById('mPts').textContent = Math.floor(fm.pts);
  document.getElementById('spFill').style.width = Math.min(100, fm.elapsed / fm.total * 100) + '%';
  document.getElementById('spLabel').textContent = fmt(fm.elapsed) + ' / ' + fmt(fm.total);
  const active = fm.isPresent && fm.screenActive && fm.contentOk;
  document.getElementById('spStatus').textContent = active ? 'Running' : 'Paused';
}

async function endSession(early) {
  clearInterval(fm.ticker); clearInterval(fm.detect); clearTimeout(contentTimer);
  if (fm.stream) fm.stream.getTracks().forEach(t => t.stop());
  if (fm.screenStream) fm.screenStream.getTracks().forEach(t => t.stop());
  document.getElementById('focusOverlay').classList.remove('open');

  const pts = Math.floor(fm.pts);
  if (fm.sessionId) {
    try {
      await API.patch('/study-sessions/' + fm.sessionId + '/end', {
        actual_focus_minutes: +(fm.present / 60).toFixed(2),
        away_minutes: +(fm.away / 60).toFixed(2),
        points_earned: pts,
      });
    } catch (e) { toast(e.message, 'error'); }
  }
  const focus = fm.elapsed ? Math.round(fm.present / fm.elapsed * 100) : 0;
  toast(pts > 0 ? `Session ${early ? 'saved' : 'complete'} — +${pts} pts (${focus}% focus)` : 'No verified focus time — no points', pts > 0 ? 'success' : '');
  // Re-sync everything from the server.
  await Promise.all([loadProfile(), loadTasks()]);
  loadOverview();
}

boot();
