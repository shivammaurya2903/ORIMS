import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../index.js';
import { loginSchema } from '../validators/auth.js';
import { validate } from '../utils/validation.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const generateTokens = (user) => {
  const tokenVersion = user.tokenVersion !== undefined ? user.tokenVersion : 0;
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, tokenVersion },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
  );
  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh', tokenVersion },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
  return { accessToken, refreshToken };
};

const setTokenCookies = (res, accessToken, refreshToken) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
    path: '/',
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
};

const clearTokenCookies = (res) => {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
};

router.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user || user.status !== 'ACTIVE') {
    return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
  }

  const { accessToken, refreshToken } = generateTokens(user);

  setTokenCookies(res, accessToken, refreshToken);

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    accessToken,
  });
});

router.post('/logout', async (req, res) => {
  // Invalidate session server-side by incrementing user's tokenVersion
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = req.cookies?.accessToken || bearerToken;
  let actorId = null;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      actorId = decoded.id;
    } catch {
      // If access token expired, try decode refresh token
      const refreshToken = req.cookies?.refreshToken;
      if (refreshToken) {
        try {
          const decodedRefresh = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
          actorId = decodedRefresh.id;
        } catch {
          // ignore invalid token
        }
      }
    }
  }

  if (actorId) {
    await prisma.user.update({
      where: { id: actorId },
      data: { tokenVersion: { increment: 1 } },
    });

    await prisma.auditLog.create({
      data: {
        actorId,
        action: 'LOGOUT',
        entityType: 'User',
        entityId: actorId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  clearTokenCookies(res);
  res.json({ message: 'Logged out successfully' });
});

router.get('/me', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
  }
  
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
  });
  
  if (!user) {
    return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
  }
  
  res.json({ user });
});

router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required', code: 'UNAUTHORIZED' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type', code: 'INVALID_TOKEN' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, role: true, status: true, tokenVersion: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      clearTokenCookies(res);
      return res.status(401).json({ error: 'User not found or inactive', code: 'UNAUTHORIZED' });
    }

    // Verify refresh token revocation state
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== (user.tokenVersion || 0)) {
      clearTokenCookies(res);
      return res.status(401).json({ error: 'Refresh token has been revoked', code: 'TOKEN_REVOKED' });
    }

    const tokens = generateTokens(user);

    setTokenCookies(res, tokens.accessToken, tokens.refreshToken);

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken: tokens.accessToken,
    });
  } catch {
    clearTokenCookies(res);
    return res.status(401).json({ error: 'Invalid refresh token', code: 'INVALID_TOKEN' });
  }
});

export default router;