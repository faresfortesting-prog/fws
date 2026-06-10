// ── CLI: run database migrations (create tables) ──
const { migrate, dbPath } = require('./index');
migrate();
console.log('✓ Migrations applied. Database at:', dbPath);
