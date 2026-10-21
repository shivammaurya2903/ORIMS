import 'dotenv/config';
import mysql from 'mysql2/promise';

let effectiveHost = process.env.DB_HOST || '127.0.0.1';
let effectivePort = Number(process.env.DB_PORT || 3306);
let effectiveUser = process.env.DB_USER || 'root';
let effectivePassword = process.env.DB_PASSWORD || '';
let effectiveDatabase = process.env.DB_NAME || 'orims';

// Graceful fallback to DATABASE_URL if DB_PASSWORD is not yet supplied in environment
if (!effectivePassword && process.env.DATABASE_URL) {
  try {
    const parsed = new URL(process.env.DATABASE_URL);
    if (parsed.username) effectiveUser = decodeURIComponent(parsed.username);
    if (parsed.password) effectivePassword = decodeURIComponent(parsed.password);
    if (parsed.hostname) effectiveHost = parsed.hostname;
    if (parsed.port) effectivePort = Number(parsed.port);
    if (parsed.pathname && parsed.pathname.length > 1) {
      effectiveDatabase = parsed.pathname.replace(/^\//, '');
    }
  } catch {}
}

const pool = mysql.createPool({
  host: effectiveHost,
  port: effectivePort,
  user: effectiveUser,
  password: effectivePassword,
  database: effectiveDatabase,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

/**
 * Safely test connection and fetch version & port
 * Uses read-only query: SELECT VERSION() AS version, @@port AS port;
 */
export async function testConnection() {
  const [rows] = await pool.query('SELECT VERSION() AS version, @@port AS port;');
  return rows[0];
}

/**
 * Check if the target application database exists
 */
export async function verifyDatabaseExists(dbName = process.env.DB_NAME || 'orims') {
  const [rows] = await pool.query(
    'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
    [dbName]
  );
  return rows.length > 0;
}

/**
 * Execute a parameterized SQL query safely using the pool
 */
export async function query(sql, params = []) {
  const [results] = await pool.execute(sql, params);
  return results;
}

export default pool;
export { pool };
