import { app, prisma } from '../src/index.js';

let server = null;
let baseUrl = '';

export async function startTestServer() {
  if (!server) {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  }
  return { server, baseUrl };
}

export async function stopTestServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
}

export async function apiRequest(path, options = {}) {
  if (!server) {
    await startTestServer();
  }
  const { method = 'GET', body, headers = {}, token } = options;
  const reqHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };
  if (token) {
    reqHeaders['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  return {
    status: res.status,
    headers: res.headers,
    body: json,
  };
}

export async function getAuthToken(role = 'ADMIN') {
  let email = 'admin@orims.local';
  if (role === 'MANAGER') email = 'manager@orims.local';
  if (role === 'SALES_STAFF') email = 'sales@orims.local';
  if (role === 'INVENTORY_STAFF') email = 'inventory@orims.local';

  const res = await apiRequest('/api/v1/auth/login', {
    method: 'POST',
    body: { email, password: 'password123' },
  });

  if (res.status !== 200 || !res.body?.accessToken) {
    throw new Error(`Failed to login as ${role}: ${JSON.stringify(res.body)}`);
  }

  return res.body.accessToken;
}

export { prisma };
