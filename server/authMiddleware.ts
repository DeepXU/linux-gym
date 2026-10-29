import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../types';
import { db } from './db';

export interface AuthSession {
  token: string;
  username: string;
  role: UserRole;
  createdAt: number;
  expiresAt: number;
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const authSessions = new Map<string, AuthSession>();

/**
 * Adaptive password hashing using Node's built-in crypto.scryptSync with unique 16-byte salts.
 */
export function hashPassword(plainPassword: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

export function verifyPassword(plainPassword: string, storedHash: string): boolean {
  if (!storedHash) return false;
  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;
    const [, salt, keyHex] = parts;
    const derived = crypto.scryptSync(plainPassword, salt, 64);
    const keyBuf = Buffer.from(keyHex, 'hex');
    if (derived.length !== keyBuf.length) return false;
    return crypto.timingSafeEqual(derived, keyBuf);
  }
  // Legacy timing-safe comparison if an older unhashed record is migrated on first login
  const a = Buffer.from(plainPassword);
  const b = Buffer.from(storedHash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function createAuthSession(
  usernameOrObj: string | { id?: string; username: string; role: UserRole },
  roleArg?: UserRole
): AuthSession {
  const username = typeof usernameOrObj === 'string' ? usernameOrObj : usernameOrObj.username;
  const role: UserRole = typeof usernameOrObj === 'string' ? (roleArg || 'student') : usernameOrObj.role;
  const token = `tok-${crypto.randomBytes(24).toString('hex')}`;
  const now = Date.now();
  const session: AuthSession = {
    token,
    username,
    role,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS
  };
  authSessions.set(token, session);
  return session;
}

export function getAuthSessionFromToken(token?: string | null): AuthSession | null {
  if (!token) return null;
  const clean = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  const sess = authSessions.get(clean);
  if (!sess) return null;
  if (Date.now() > sess.expiresAt) {
    authSessions.delete(clean);
    return null;
  }
  return sess;
}

export function getAuthSessionFromRequest(req: Request): AuthSession | null {
  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return getAuthSessionFromToken(authHeader);
  }
  return null;
}

export function revokeAuthSession(token?: string | null): void {
  if (!token) return;
  const clean = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  authSessions.delete(clean);
}

/**
 * Strips passwordHash and any sensitive credential fields before returning user records.
 */
export function sanitizeUserRecord(record: any): any {
  if (!record || typeof record !== 'object') return null;
  const userObj = record.user ? { ...record.user } : { ...record };
  delete userObj.passwordHash;
  delete userObj.password;
  return {
    user: userObj,
    state: record.state || null,
    logs: Array.isArray(record.logs) ? record.logs : []
  };
}

export function sanitizeUsersMap(usersMap: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [username, rec] of Object.entries(usersMap || {})) {
    out[username] = sanitizeUserRecord(rec);
  }
  return out;
}

/**
 * Centralized Role-Based Access Control (RBAC) Middlewares.
 * Never trusts x-auth-role headers or query string flags (?admin=true).
 */
export function requireAuthenticated(req: Request, res: Response, next: NextFunction) {
  const sess = getAuthSessionFromRequest(req);
  if (!sess) {
    return res.status(401).json({ error: 'Authentication required. Provide a valid Bearer session token.' });
  }
  (req as any).authSession = sess;
  next();
}

export function requireResearcher(req: Request, res: Response, next: NextFunction) {
  const sess = getAuthSessionFromRequest(req);
  if (!sess || (sess.role !== 'admin' && sess.role !== 'evaluator')) {
    return res.status(403).json({ error: 'Researcher or Administrator authorization required.' });
  }
  (req as any).authSession = sess;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const sess = getAuthSessionFromRequest(req);
  if (!sess || sess.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator authorization required.' });
  }
  (req as any).authSession = sess;
  next();
}

export function requireUnlockedOrPermittedMutation(req: Request, res: Response, next: NextFunction) {
  const activeRun = db.getActiveRun();
  if (activeRun && activeRun.isLocked) {
    return res.status(403).json({
      error: `Cannot mutate configuration, task catalog, or protocol settings while formal run '${activeRun.runId}' is locked.`
    });
  }
  next();
}

/**
 * Sliding-window in-memory rate limiter per IP + endpoint group.
 */
const rateLimitBuckets = new Map<string, number[]>();

export function createRateLimiter(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'local';
    const key = `${ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    const timestamps = (rateLimitBuckets.get(key) || []).filter(t => now - t < windowMs);
    if (timestamps.length >= maxRequests) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please wait before retrying.'
      });
    }
    timestamps.push(now);
    rateLimitBuckets.set(key, timestamps);
    next();
  };
}
