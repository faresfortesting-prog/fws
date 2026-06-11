// ════ Instructor dashboard logic ════
let ME = null, CLASSES = [], COURSES = [], CURRENT_TASKS = [], EDIT_TASK = null;

async function boot() {
  ME = await requireUser(['instructor', 'admin']);
  if (!ME) return;
  document.getElementById('sideName').textContent = ME.full_name;
  document.getElementById('sideEmail').textContent = ME.email;
  document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  await loadClasses();
  await loadCourses();
  showView('overview');
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));
  document.getElementById(name).classList.add('active');
  document.getElementById('pageTitle').textContent = name.charAt(0).toUpperCase() + name.slice(1);
  document.getElementById('sidebar').classList.remove('open');
  ({ overview: loadOverview, calendar: loadCalendar, classes: renderClasses, courses: renderCourses, tasks: loadTasks,
     students: loadStudents, verification: loadVerification, points: loadPointStudents,
     announcements: loadAnnouncements, messages: loadMessages, reports: renderReportControls, audit: loadAudit }[name] || (() => {}))();
}

function fillClassSelects() {
  const opts = CLASSES.map(c => `<option value="${c.id}">${esc(c.class_name)}</option>`).join('');
  ['taskClass', 'stuClass', 'ptClass', 'annClass', 'msgClass', 'repClass'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = opts || '<option value="">No classes</option>';
  });
}

async function loadClasses() { CLASSES = await API.get('/instructor/classes'); fillClassSelects(); }
async function loadCourses() {
  COURSES = await API.get('/instructor/courses');
  const sel = document.getElementById('cmCourse');
  if (sel) sel.innerHTML = '<option value="">— create new below —</option>' +
    COURSES.map(c => `<option value="${c.id}">${esc(c.course_code)} ${esc(c.course_name)}</option>`).join('');
}

// ── Overview ──
async function loadOverview() {
  const d = await API.get('/instructor/dashboard');
  document.getElementById('ovKpis').innerHTML = `
    ${kpi('Total Students', d.totalStudents)}
    ${kpi('Active Today', d.activeToday)}
    ${kpi('Avg Focus', d.avgFocus + '%')}
    ${kpi('Study Hours', d.totalStudyHours)}
    ${kpi('Tasks Completed', d.tasksCompleted)}
    ${kpi('At Risk', d.studentsAtRisk, '', d.studentsAtRisk > 0)}`;
  document.getElementById('ovLeaders').innerHTML = d.leaderboard.length
    ? d.leaderboard.map((r, i) => `<div class="lb-row"><div class="lb-rank">${['🥇', '🥈', '🥉'][i] || '#' + (i + 1)}</div>
      <div class="lb-avatar">${initials(r.name)}</div><div class="lb-info"><div class="lb-name">${esc(r.name)}</div>
      <div class="lb-streak">🔥 ${r.streak}-day streak</div></div><div class="lb-pts">${(r.points || 0).toLocaleString()}</div></div>`).join('')
    : empty('🏆', 'No students yet', 'Create a class and share its code.');
}

// ── Calendar ──
let CAL_EVENTS = [], calRef = new Date();
async function loadCalendar() {
  try { CAL_EVENTS = await API.get('/instructor/calendar'); }
  catch { CAL_EVENTS = []; }
  // Soonest deadline first; open the calendar on the month of the next upcoming deadline.
  CAL_EVENTS.sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  const todayStr = new Date().toISOString().slice(0, 10);
  const next = CAL_EVENTS.find(e => e.due_date >= todayStr) || CAL_EVENTS[0];
  calRef = next ? new Date(next.due_date) : new Date();
  renderCalendar();
}
function calMonth(delta) { calRef.setMonth(calRef.getMonth() + delta); renderCalendar(); }
function renderCalendar() {
  const y = calRef.getFullYear(), m = calRef.getMonth();
  document.getElementById('calLabel').textContent =
    calRef.toLocaleString('default', { month: 'long', year: 'numeric' });
  // Bucket events by YYYY-MM-DD
  const byDay = {};
  CAL_EVENTS.forEach(e => { (byDay[e.due_date] = byDay[e.due_date] || []).push(e); });

  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);
  let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-head">${d}</div>`).join('');
  for (let i = 0; i < first; i++) html += '<div class="cal-cell empty"></div>';
  for (let d = 1; d <= days; d++) {
    const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const evs = byDay[ds] || [];
    const shown = evs.slice(0, 2).map(e =>
      `<div class="cal-ev urg-${e.urgency}" title="${esc(e.title)} — ${esc(e.class_name)}">${esc(e.title)}</div>`).join('');
    const more = evs.length > 2 ? `<div class="cal-more">+${evs.length - 2} more</div>` : '';
    html += `<div class="cal-cell ${ds === todayStr ? 'today' : ''}">
      <div class="cal-daynum">${d}</div>${shown}${more}</div>`;
  }
  document.getElementById('calGrid').innerHTML = html;

  // Agenda: upcoming, from today
  const upcoming = CAL_EVENTS.filter(e => e.due_date >= todayStr).slice(0, 12);
  document.getElementById('calAgenda').innerHTML = upcoming.length
    ? `<table><tr><th>Due</th><th>Deadline</th><th>Class</th><th>Type</th><th>Completion</th></tr>` +
      upcoming.map(e => {
        const rate = e.enrolled ? Math.round(e.completed / e.enrolled * 100) : 0;
        return `<tr><td><b>${new Date(e.due_date).toLocaleDateString()}</b></td><td>${esc(e.title)}</td>
          <td>${esc(e.class_name)}</td><td><span class="pill pill-navy">${esc(e.task_type)}</span></td>
          <td>${rate}%</td></tr>`;
      }).join('') + '</table>'
    : empty('📅', 'No upcoming deadlines', 'Tasks with due dates appear here.');
}

// ── Classes ──
function renderClasses() {
  const el = document.getElementById('classList');
  if (!CLASSES.length) return el.innerHTML = empty('🏫', 'No classes yet', 'Create your first class to get started.');
  el.innerHTML = CLASSES.map(c => `<div class="card"><div class="card-head">
    <div><div class="sec-title">${esc(c.class_name)}</div>
      <div style="font-size:12.5px;color:var(--muted)">${esc(c.course_code || 'No course')} · ${c.student_count} students · ${c.task_count} tasks</div></div>
    <span class="pill ${c.status === 'active' ? 'pill-green' : 'pill-grey'}">${c.status}</span></div>
    <div class="toolbar" style="margin:0">
      <code style="background:#0d1117;color:#7ee787;padding:.4rem .8rem;border-radius:6px">${esc(c.join_code)}</code>
      <button class="btn btn-ghost btn-sm" onclick="regenCode(${c.id})">↻ Regenerate</button>
      <button class="btn btn-ghost btn-sm" onclick="copyText('${esc(c.join_code)}')">Copy</button>
      <button class="btn btn-ghost btn-sm" onclick="archiveClass(${c.id})">${c.status === 'active' ? 'Archive' : 'Activate'}</button>
      <button class="btn btn-danger btn-sm" onclick="deleteClass(${c.id})">Delete</button>
    </div></div>`).join('');
}
async function regenCode(id) { try { const r = await API.post('/classes/' + id + '/join-code'); toast('New code: ' + r.join_code, 'success'); await loadClasses(); renderClasses(); } catch (e) { toast(e.message, 'error'); } }
async function archiveClass(id) { const c = CLASSES.find(x => x.id === id); try { await API.patch('/instructor/classes/' + id, { status: c.status === 'active' ? 'archived' : 'active' }); await loadClasses(); renderClasses(); } catch (e) { toast(e.message, 'error'); } }
async function deleteClass(id) { if (!confirm('Delete this class and all its data?')) return; try { await API.del('/instructor/classes/' + id); toast('Class deleted', 'success'); await loadClasses(); renderClasses(); } catch (e) { toast(e.message, 'error'); } }

function openClassModal() { document.getElementById('classOverlay').classList.add('open'); }
async function createClass() {
  try {
    await API.post('/instructor/classes', {
      class_name: document.getElementById('cmName').value.trim(),
      course_id: document.getElementById('cmCourse').value || null,
      course_code: document.getElementById('cmCode').value.trim(),
      course_name: document.getElementById('cmCourseName').value.trim(),
      approval_mode: document.getElementById('cmApproval').checked,
    });
    close_('classOverlay'); toast('Class created', 'success');
    await loadClasses(); await loadCourses(); renderClasses();
  } catch (e) { toast(e.message, 'error'); }
}

// ── Courses ──
function renderCourses() {
  const el = document.getElementById('courseList');
  el.innerHTML = COURSES.length ? `<table><tr><th>Code</th><th>Name</th><th>Semester</th><th>Status</th></tr>` +
    COURSES.map(c => `<tr><td><b>${esc(c.course_code)}</b></td><td>${esc(c.course_name)}</td><td>${esc(c.semester || '—')}</td><td>${esc(c.status)}</td></tr>`).join('') + '</table>'
    : empty('📚', 'No courses', 'Create a course to organise your classes.');
}
function openCourseModal() { document.getElementById('courseOverlay').classList.add('open'); }
async function createCourse() {
  try {
    await API.post('/instructor/courses', {
      course_code: document.getElementById('coCode').value.trim(),
      course_name: document.getElementById('coName').value.trim(),
      semester: document.getElementById('coSem').value.trim(),
      description: document.getElementById('coDesc').value.trim(),
    });
    close_('courseOverlay'); toast('Course created', 'success'); await loadCourses(); renderCourses();
  } catch (e) { toast(e.message, 'error'); }
}

// ── Tasks ──
async function loadTasks() {
  const cid = document.getElementById('taskClass').value;
  if (!cid) return document.getElementById('taskList').innerHTML = empty('📋', 'No class', 'Create a class first.');
  CURRENT_TASKS = await API.get('/classes/' + cid + '/tasks');
  renderTasks();
}
function renderTasks() {
  const sort = document.getElementById('taskSort').value;
  const ord = { critical: 0, high: 1, medium: 2, low: 3 };
  const t = [...CURRENT_TASKS].sort((a, b) =>
    sort === 'urgency' ? ord[a.urgency] - ord[b.urgency] :
    sort === 'completion' ? (b.completion_rate || 0) - (a.completion_rate || 0) :
    sort === 'points' ? b.points - a.points :
    String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')));
  const el = document.getElementById('taskList');
  if (!t.length) return el.innerHTML = empty('📋', 'No tasks yet', 'Add tasks for this class.');
  el.innerHTML = t.map(task => `<div class="task-card urg-${task.urgency}">
    <div class="task-top"><div><div class="task-title">${esc(task.title)}</div>
      <div class="task-course">${esc(task.task_type)} · ${task.points} pts · ${task.status}</div></div>
      <span class="pill pill-navy">${task.completion_rate || 0}% complete</span></div>
    <div class="prog-bar"><div class="prog-fill" style="width:${task.completion_rate || 0}%"></div></div>
    <div class="toolbar" style="margin:.6rem 0 0">
      <button class="btn btn-ghost btn-sm" onclick="editTask(${task.id})">Edit</button>
      <button class="btn btn-ghost btn-sm" onclick="dupTask(${task.id})">Duplicate</button>
      <button class="btn btn-ghost btn-sm" onclick="togglePublish(${task.id})">${task.status === 'published' ? 'Unpublish' : 'Publish'}</button>
      <button class="btn btn-danger btn-sm" onclick="delTask(${task.id})">Delete</button>
    </div></div>`).join('');
}
function openTaskModal() { EDIT_TASK = null; document.getElementById('taskModalTitle').textContent = 'New Task';
  ['tmTitle', 'tmEst', 'tmDue', 'tmDesc'].forEach(i => document.getElementById(i).value = '');
  document.getElementById('tmPoints').value = 100; document.getElementById('taskOverlay').classList.add('open'); }
function editTask(id) { const t = CURRENT_TASKS.find(x => x.id === id); EDIT_TASK = t;
  document.getElementById('taskModalTitle').textContent = 'Edit Task';
  document.getElementById('tmTitle').value = t.title; document.getElementById('tmType').value = t.task_type;
  document.getElementById('tmPoints').value = t.points; document.getElementById('tmEst').value = t.estimated_time || '';
  document.getElementById('tmDue').value = t.due_date || ''; document.getElementById('tmUrg').value = t.urgency;
  document.getElementById('tmDesc').value = t.description || ''; document.getElementById('taskOverlay').classList.add('open'); }
async function saveTask() {
  const body = {
    title: document.getElementById('tmTitle').value.trim(), task_type: document.getElementById('tmType').value,
    points: +document.getElementById('tmPoints').value, estimated_time: document.getElementById('tmEst').value.trim(),
    due_date: document.getElementById('tmDue').value || null, urgency: document.getElementById('tmUrg').value,
    description: document.getElementById('tmDesc').value.trim(),
  };
  try {
    if (EDIT_TASK) await API.patch('/tasks/' + EDIT_TASK.id, body);
    else await API.post('/classes/' + document.getElementById('taskClass').value + '/tasks', body);
    close_('taskOverlay'); toast('Task saved', 'success'); loadTasks();
  } catch (e) { toast(e.message, 'error'); }
}
async function dupTask(id) { try { await API.post('/tasks/' + id + '/duplicate'); toast('Duplicated', 'success'); loadTasks(); } catch (e) { toast(e.message, 'error'); } }
async function togglePublish(id) { const t = CURRENT_TASKS.find(x => x.id === id); try { await API.patch('/tasks/' + id, { status: t.status === 'published' ? 'draft' : 'published' }); loadTasks(); } catch (e) { toast(e.message, 'error'); } }
async function delTask(id) { if (!confirm('Delete this task?')) return; try { await API.del('/tasks/' + id); toast('Deleted', 'success'); loadTasks(); } catch (e) { toast(e.message, 'error'); } }

// ── Students ──
let STUDENTS = [];
async function loadStudents() {
  const cid = document.getElementById('stuClass').value;
  if (!cid) return document.getElementById('studentList').innerHTML = empty('🎓', 'No class', '');
  try { STUDENTS = await API.get('/classes/' + cid + '/students'); renderStudents(); }
  catch (e) { document.getElementById('studentList').innerHTML = `<div class="error-banner">${esc(e.message)}</div>`; }
}
function renderStudents() {
  const q = (document.getElementById('stuSearch').value || '').toLowerCase();
  const riskOnly = document.getElementById('stuRisk').checked;
  const cid = document.getElementById('stuClass').value;
  let rows = STUDENTS.filter(s => s.full_name.toLowerCase().includes(q));
  if (riskOnly) rows = rows.filter(s => s.at_risk);
  const el = document.getElementById('studentList');
  if (!rows.length) return el.innerHTML = empty('🎓', 'No students', 'Share the class code to enrol students.');
  el.innerHTML = `<table><tr><th>Student</th><th>Points</th><th>Streak</th><th>Avg Focus</th><th>Done</th><th>Status</th><th></th></tr>` +
    rows.map(s => `<tr><td><b>${esc(s.full_name)}</b><br><span style="font-size:11px;color:var(--muted)">${esc(s.email)}</span></td>
      <td>${(s.total_points || 0).toLocaleString()}</td><td>🔥 ${s.current_streak || 0}</td><td>${s.avg_focus}%</td><td>${s.tasks_done}</td>
      <td>${s.at_risk ? '<span class="pill pill-red">at risk</span>' : '<span class="pill pill-green">ok</span>'}${s.enrollment_status === 'pending' ? ' <span class="pill pill-amber">pending</span>' : ''}</td>
      <td>${s.enrollment_status === 'pending' ? `<button class="btn btn-teal btn-sm" onclick="approveStu(${cid},${s.id})">Approve</button>` : ''}
        <button class="btn btn-danger btn-sm" onclick="removeStu(${cid},${s.id})">Remove</button></td></tr>`).join('') + '</table>';
}
async function approveStu(cid, sid) { try { await API.post(`/classes/${cid}/students/${sid}/approve`); loadStudents(); } catch (e) { toast(e.message, 'error'); } }
async function removeStu(cid, sid) { if (!confirm('Remove this student?')) return; try { await API.del(`/classes/${cid}/students/${sid}`); loadStudents(); } catch (e) { toast(e.message, 'error'); } }

// ── Verification ──
async function loadVerification() {
  try {
    const rows = await API.get('/instructor/verification-events');
    const el = document.getElementById('verifyList');
    el.innerHTML = rows.length ? `<table><tr><th>Student</th><th>Event</th><th>Reason</th><th>Severity</th><th>Focus</th><th>When</th></tr>` +
      rows.map(v => `<tr><td>${esc(v.student_name)}</td><td><span class="pill ${v.event_type.includes('off') || v.event_type.includes('missing') || v.event_type.includes('disconnect') ? 'pill-amber' : 'pill-green'}">${esc(v.event_type)}</span></td>
        <td>${esc(v.reason || '—')}</td><td>${esc(v.severity)}</td><td>${v.focus_percentage}%</td><td>${new Date(v.event_time).toLocaleString()}</td></tr>`).join('') + '</table>'
      : empty('🔍', 'No events', 'Verification summaries appear here after students study.');
  } catch (e) { document.getElementById('verifyList').innerHTML = `<div class="error-banner">${esc(e.message)}</div>`; }
}

// ── Points ──
async function loadPointStudents() {
  const cid = document.getElementById('ptClass').value;
  if (!cid) return;
  const rows = await API.get('/classes/' + cid + '/students');
  document.getElementById('ptStudent').innerHTML = rows.map(s => `<option value="${s.id}">${esc(s.full_name)}</option>`).join('');
}
async function adjustPoints() {
  const cid = document.getElementById('ptClass').value;
  const sid = document.getElementById('ptStudent').value;
  const delta = +document.getElementById('ptDelta').value;
  const reason = document.getElementById('ptReason').value.trim();
  if (!sid || !delta || !reason) return toast('Student, points and reason are required', 'error');
  try {
    const r = await API.post('/points/adjust', { student_id: +sid, class_id: +cid, delta, reason });
    toast('Adjusted — new total ' + r.new_total, 'success');
    document.getElementById('ptDelta').value = ''; document.getElementById('ptReason').value = '';
    const audit = await API.get('/points/audit/' + sid);
    document.getElementById('ptAudit').innerHTML = `<table><tr><th>Δ</th><th>Reason</th><th>By</th><th>When</th></tr>` +
      audit.map(a => `<tr><td>${a.delta > 0 ? '+' : ''}${a.delta}</td><td>${esc(a.reason)}</td><td>${esc(a.actor_name || '—')}</td><td>${new Date(a.created_at).toLocaleString()}</td></tr>`).join('') + '</table>';
  } catch (e) { toast(e.message, 'error'); }
}

// ── Announcements ──
async function loadAnnouncements() {
  try {
    const rows = await API.get('/announcements');
    document.getElementById('annList').innerHTML = rows.map(a => `<div class="card" style="margin-bottom:.6rem">
      <div class="sec-title" style="font-size:14px">${a.pinned ? '📌 ' : ''}${esc(a.title)} <span style="font-size:11px;color:var(--muted);font-weight:400">${esc(a.class_name)}</span></div>
      <div style="font-size:13px;margin-top:.4rem">${esc(a.message)}</div></div>`).join('') || empty('📢', 'No announcements', '');
  } catch {}
}
async function postAnnouncement() {
  try {
    await API.post('/announcements', {
      class_id: +document.getElementById('annClass').value, title: document.getElementById('annTitle').value.trim(),
      message: document.getElementById('annMsg').value.trim(), pinned: document.getElementById('annPin').checked,
    });
    document.getElementById('annTitle').value = ''; document.getElementById('annMsg').value = '';
    toast('Posted', 'success'); loadAnnouncements();
  } catch (e) { toast(e.message, 'error'); }
}

// ── Messages ──
async function loadMessages() {
  try {
    const { messages } = await API.get('/messages');
    document.getElementById('msgList').innerHTML = messages.length ? messages.map(m => `<div class="card" style="margin-bottom:.5rem">
      <b>${esc(m.sender_name)}</b><div style="font-size:13px;margin:.3rem 0">${esc(m.body)}</div>
      <div style="font-size:11px;color:var(--muted)">${new Date(m.created_at).toLocaleString()}</div></div>`).join('') : empty('✉️', 'No messages', '');
  } catch {}
}
async function sendClassMessage() {
  try {
    await API.post('/messages', { class_id: +document.getElementById('msgClass').value, body: document.getElementById('msgBody').value.trim() });
    document.getElementById('msgBody').value = ''; toast('Sent to class', 'success'); loadMessages();
  } catch (e) { toast(e.message, 'error'); }
}

// ── Reports ──
function renderReportControls() { /* selects already filled */ }
async function viewReport() {
  const cid = document.getElementById('repClass').value;
  try {
    const rows = await API.get('/reports/class/' + cid);
    document.getElementById('repTable').innerHTML = rows.length ? `<table><tr><th>Student</th><th>Points</th><th>Streak</th><th>Tasks Done</th><th>Avg Focus</th></tr>` +
      rows.map(r => `<tr><td>${esc(r.student)}</td><td>${r.points}</td><td>${r.streak}</td><td>${r.tasks_completed}</td><td>${r.avg_focus || 0}%</td></tr>`).join('') + '</table>'
      : empty('📈', 'No data', '');
  } catch (e) { toast(e.message, 'error'); }
}
function downloadReport() {
  const cid = document.getElementById('repClass').value;
  // CSV export uses the same authenticated endpoint with ?format=csv via a fetch + blob.
  API.request('GET', '/reports/class/' + cid + '?format=csv').then(csv => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'class-' + cid + '-report.csv'; a.click();
  }).catch(e => toast(e.message, 'error'));
}

// ── Audit ──
async function loadAudit() {
  try {
    const rows = await API.get('/instructor/audit-log');
    document.getElementById('auditList').innerHTML = rows.length ? `<table><tr><th>Action</th><th>Target</th><th>Detail</th><th>When</th></tr>` +
      rows.map(a => `<tr><td>${esc(a.action)}</td><td>${esc(a.target_type || '')} ${a.target_id || ''}</td><td style="font-size:11px">${esc(a.detail || '')}</td><td>${new Date(a.created_at).toLocaleString()}</td></tr>`).join('') + '</table>'
      : empty('🗂️', 'No actions logged', '');
  } catch {}
}

// ── helpers ──
function kpi(l, v, s, warn) { return `<div class="kpi-card ${warn ? 'warn' : ''}"><div class="label">${l}</div><div class="value">${v}</div><div class="sub">${s || ''}</div></div>`; }
function empty(i, h, p) { return `<div class="empty"><div class="ico">${i}</div><h3>${h}</h3><p>${p}</p></div>`; }
function close_(id) { document.getElementById(id).classList.remove('open'); }
function copyText(t) { navigator.clipboard.writeText(t).then(() => toast('Copied: ' + t)); }

boot();
