import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopTestServer, apiRequest, getAuthToken, prisma } from './helpers.js';

describe('Auth & Authorization Suite', () => {
  beforeAll(async () => {
    await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer();
    await prisma.$disconnect();
  });

  it('POST /api/v1/auth/login returns accessToken and user profile', async () => {
    const res = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'admin@orims.local', password: 'password123' },
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user).toMatchObject({
      email: 'admin@orims.local',
      role: 'ADMIN',
    });
  });

  it('POST /api/v1/auth/login rejects invalid credentials with 401', async () => {
    const res = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'admin@orims.local', password: 'wrongpassword' },
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid credentials/i);
  });

  it('GET /api/v1/auth/me returns current user when authenticated', async () => {
    const token = await getAuthToken('ADMIN');
    const res = await apiRequest('/api/v1/auth/me', { token });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('admin@orims.local');
    expect(res.body.user.role).toBe('ADMIN');
  });

  it('GET /api/v1/auth/me rejects unauthenticated request with 401', async () => {
    const res = await apiRequest('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('enforces RBAC: SALES_STAFF cannot access /api/v1/users (returns 403)', async () => {
    const token = await getAuthToken('SALES_STAFF');
    const res = await apiRequest('/api/v1/users', { token });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Insufficient permissions/i);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('enforces RBAC: ADMIN can access /api/v1/users (returns 200)', async () => {
    const token = await getAuthToken('ADMIN');
    const res = await apiRequest('/api/v1/users', { token });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/v1/auth/logout succeeds and returns 200', async () => {
    const token = await getAuthToken('ADMIN');
    const res = await apiRequest('/api/v1/auth/logout', {
      method: 'POST',
      token,
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Logged out successfully/i);
  });
});
