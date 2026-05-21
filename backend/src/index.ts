import { env } from './env.js';
import { app } from './app.js';
import { pool } from './db/index.js';

const server = app.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
});

async function shutdown() {
  console.log('Shutting down gracefully...');
  server.close();
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
