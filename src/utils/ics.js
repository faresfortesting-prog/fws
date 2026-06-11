// ── iCalendar (.ics) parser — turns a Blackboard calendar feed into task objects ──
// Pure, dependency-free. Handles line folding, common date formats, and escapes.

// Unfold folded lines (RFC 5545: continuation lines start with space/tab).
function unfold(raw) {
  return raw.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

// Parse an ICS date/datetime value into a 'YYYY-MM-DD' string (or null).
function parseDate(val) {
  if (!val) return null;
  const m = val.match(/(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

// Unescape ICS text (\, \; \n etc.)
function unescape(s) {
  return (s || '').replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
}

// Map a task title to a StudyStrike task_type by keyword.
function detectType(title) {
  const t = title.toLowerCase();
  if (/\bexam|final|midterm\b/.test(t)) return 'exam';
  if (/\bquiz\b/.test(t)) return 'quiz';
  if (/\blab\b/.test(t)) return 'lab';
  if (/\bproject\b/.test(t)) return 'project';
  if (/\bessay|paper\b/.test(t)) return 'essay';
  if (/\bread(ing)?\b/.test(t)) return 'reading';
  return 'assignment';
}

// Urgency from how many days until due.
function urgencyFromDate(dueISO) {
  if (!dueISO) return 'low';
  const days = Math.round((new Date(dueISO) - new Date()) / 86400000);
  if (days <= 0) return 'critical';
  if (days <= 2) return 'high';
  if (days <= 6) return 'medium';
  return 'low';
}

// Parse a full ICS document into an array of {uid,title,due_date,description,task_type,urgency}.
function parseICS(raw) {
  const text = unfold(raw);
  const events = [];
  const blocks = text.split('BEGIN:VEVENT').slice(1);
  for (const block of blocks) {
    const body = block.split('END:VEVENT')[0];
    const props = {};
    for (const line of body.split('\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const keyRaw = line.slice(0, idx);       // may include ;params
      const key = keyRaw.split(';')[0].toUpperCase();
      const value = line.slice(idx + 1);
      if (!(key in props)) props[key] = value;  // keep first occurrence
    }
    const title = unescape(props.SUMMARY);
    if (!title) continue;
    // Blackboard puts the deadline in DUE or DTSTART.
    const due = parseDate(props.DUE) || parseDate(props.DTSTART) || parseDate(props.DTEND);
    events.push({
      uid: (props.UID || title).trim(),
      title,
      due_date: due,
      description: unescape(props.DESCRIPTION),
      task_type: detectType(title),
      urgency: urgencyFromDate(due),
    });
  }
  return events;
}

module.exports = { parseICS };
