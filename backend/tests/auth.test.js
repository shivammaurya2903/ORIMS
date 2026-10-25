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
    const adminToken = await getAuthToken('ADMIN');
    const uniqueEmail = `logout_user_${Date.now()}@orims.local`;
    await apiRequest('/api/v1/users', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Logout Test User',
        email: uniqueEmail,
        password: 'password123',
        role: 'INVENTORY_STAFF',
      },
    });

    const loginRes = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { email: uniqueEmail, password: 'password123' },
    });
    const userToken = loginRes.body.accessToken;

    const res = await apiRequest('/api/v1/auth/logout', {
      method: 'POST',
      token: userToken,
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Logged out successfully/i);
  });

  it('rejects login with malformed/missing fields with 400 validation error', async () => {
    const res = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'not-an-email', password: '123' },
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('admin creates account end-to-end, assigns role, and rejects duplicate email', async () => {
    const token = await getAuthToken('ADMIN');
    const uniqueEmail = `staff_${Date.now()}@orims.local`;

    // 1. Create account
    const createRes = await apiRequest('/api/v1/users', {
      method: 'POST',
      token,
      body: {
        name: 'Automated Test Staff',
        email: uniqueEmail,
        password: 'password123',
        role: 'INVENTORY_STAFF',
      },
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.user).toMatchObject({
      email: uniqueEmail,
      role: 'INVENTORY_STAFF',
      status: 'ACTIVE',
    });

    const newUserId = createRes.body.user.id;

    // 2. Reject duplicate account creation
    const dupRes = await apiRequest('/api/v1/users', {
      method: 'POST',
      token,
      body: {
        name: 'Duplicate Staff',
        email: uniqueEmail,
        password: 'password123',
        role: 'INVENTORY_STAFF',
      },
    });
    expect(dupRes.status).toBe(400);
    expect(dupRes.body.error).toMatch(/already registered/i);

    // 3. New user authenticates successfully
    const loginRes = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { email: uniqueEmail, password: 'password123' },
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.role).toBe('INVENTORY_STAFF');

    // 4. Deactivate account and verify disabled account cannot authenticate
    const deactRes = await apiRequest(`/api/v1/users/${newUserId}`, {
      method: 'PATCH',
      token,
      body: { status: 'INACTIVE' },
    });
    expect(deactRes.status).toBe(200);
    expect(deactRes.body.user.status).toBe('INACTIVE');

    const blockedLogin = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { email: uniqueEmail, password: 'password123' },
    });
    expect(blockedLogin.status).toBe(401);
    expect(blockedLogin.body.error).toMatch(/Invalid credentials/i);
  });

  it('POST /api/v1/auth/refresh rejects requests without refresh cookie/token', async () => {
    const res = await apiRequest('/api/v1/auth/refresh', {
      method: 'POST',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/refresh token/i);
  });
});
