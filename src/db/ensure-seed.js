// ── Boot helper for hosted deploys ──
// Runs migrations, then seeds demo/team data ONLY if the database is empty.
// This keeps real sign-ups across restarts while guaranteeing a fresh deploy
// boots with the team accounts already present.
const { db, migrate } = require('./index');
migrate();

const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (count === 0) {
  console.log('Empty database → seeding initial data…');
  require('./seed');   // seed.js runs on require (and calls process.exit when done)
} else {
  console.log(`Database already has ${count} users → skipping seed.`);
}
