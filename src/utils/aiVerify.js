// ── Server-side screen-content verification ──
// The Anthropic API key lives ONLY on the server. The frontend sends a frame to
// our backend, we analyse it, and return only a {compliant, reason} summary.
// The raw frame is never stored — privacy by design.
const config = require('../config');

const SYSTEM_PROMPT =
  'You are a study compliance monitor. Analyse the screenshot and determine if it shows ' +
  'study-related content (documents, notes, textbooks, coding IDEs, educational websites, ' +
  'lecture slides, PDFs, spreadsheets, or anything academically productive). Respond with ' +
  'ONLY a JSON object: {"compliant": true/false, "reason": "short phrase"}. No other text.';

async function checkScreenContent(frameBase64, taskTitle) {
  // No key configured → privacy-safe fallback (assume compliant, never block falsely).
  if (!config.anthropicApiKey || !frameBase64) {
    return { compliant: true, reason: 'Content check unavailable', source: 'fallback' };
  }
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.anthropicModel,
        max_tokens: 120,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: frameBase64 } },
            { type: 'text', text: `The student is working on: "${taskTitle || 'their studies'}". Is this screen study-related?` },
          ],
        }],
      }),
    });
    const data = await resp.json();
    const raw = (data.content || []).map(c => c.text || '').join('');
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return {
      compliant: parsed.compliant === true,
      reason: parsed.reason || (parsed.compliant ? 'On-task' : 'Off-task content'),
      source: 'ai',
    };
  } catch {
    // On any error, do not falsely penalise the student.
    return { compliant: true, reason: 'Content check error — assumed OK', source: 'error' };
  }
}

module.exports = { checkScreenContent };
