import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testConnection, verifyDatabaseExists, query } from '../src/db.js';
import { apiRequest, startTestServer, stopTestServer } from './helpers.js';

describe('MySQL2 Pool & Health Check Suite', () => {
  beforeAll(async () => {
    await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer();
  });

  it('connects to MySQL and verifies version and port', async () => {
    const res = await testConnection();
    expect(res).toBeDefined();
    expect(res.version).toContain('8.4');
    expect(Number(res.port)).toBe(3306);
  });

  it('verifies the application database orims exists', async () => {
    const exists = await verifyDatabaseExists('orims');
    expect(exists).toBe(true);
  });

  it('executes parameterized SQL queries safely', async () => {
    const rows = await query('SELECT ? AS testVal, ? AS numVal', ['parameterized_check', 42]);
    expect(rows).toBeDefined();
    expect(rows.length).toBe(1);
    expect(rows[0].testVal).toBe('parameterized_check');
    expect(Number(rows[0].numVal)).toBe(42);
  });

  it('GET /api/v1/health/db returns 200 with database status and version info', async () => {
    const res = await apiRequest('/api/v1/health/db');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.database).toBe('connected');
    expect(res.body.version).toContain('8.4');
    expect(Number(res.body.port)).toBe(3306);
  });
});
