import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.DATABASE_URL ?? '';
const requireSSL = dbUrl.includes('supabase.co') || process.env.NODE_ENV === 'production';

// Parse the URL manually so pg receives the decoded password directly —
// this handles passwords with special characters like / without URL-encoding issues
const parsed = new URL(dbUrl);
const config: PoolConfig = {
  host: parsed.hostname,
  port: parseInt(parsed.port) || 5432,
  database: parsed.pathname.slice(1),
  user: parsed.username,
  password: decodeURIComponent(parsed.password),
  ssl: requireSSL ? { rejectUnauthorized: false } : false,
  max: process.env.NODE_ENV === 'production' ? 2 : 10,
};

export const pool = new Pool(config);
