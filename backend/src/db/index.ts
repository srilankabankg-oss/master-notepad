import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

const { Pool } = pg;

import { env } from '../env.js';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

export { pool };

export const db = drizzle(pool, { schema });
export { schema };
