import { pool } from './db';

let cachedUserId: number | null = null;

// Creates a single guest user on first call, caches the ID for subsequent requests
export async function getDefaultUserId(): Promise<number> {
  if (cachedUserId !== null) return cachedUserId;
  const result = await pool.query(`
    INSERT INTO users (email, password_hash, daily_calorie_goal)
    VALUES ('guest@local', 'no-auth', 2000)
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
    RETURNING id
  `);
  cachedUserId = result.rows[0].id as number;
  return cachedUserId;
}
