import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { IncomingMessage } from 'http';
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
  if (!plainPassword || !storedHash) return false;
  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;
    const [, salt, keyHex] = parts;
    const derived = crypto.scryptSync(plainPassword, salt, 64);
    const keyBuf = Buffer.from(keyHex, 'hex');
    if (derived.length !== keyBuf.length) return false;
    return crypto.timingSafeEqual(derived, keyBuf);
  }
  const a = Buffer.from(plainPassword);
  const b = Buffer.from(storedHash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function createAuthSession(
  usernameOrObj: string | { id?: string; username: string; role: UserRole },
  roleArg?: UserRole,
  customTtlMs?: number
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
    expiresAt: now + (customTtlMs ?? SESSION_TTL_MS)
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

export function revokeAuthSession(token?: string | null): boolean {
  if (!token) return false;
  const clean = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  return authSessions.delete(clean);
}

export function clearAllAuthSessions(): void {
  authSessions.clear();
}

/**
 * Verifies WebSocket upgrade requests (/pty).
 * Prefers Authorization header or Sec-WebSocket-Protocol token over query parameters.
 */
export function verifyWebSocketAuthorization(req: IncomingMessage): {
  authorized: boolean;
  session: AuthSession | null;
  reason?: string;
} {
  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const sess = getAuthSessionFromToken(authHeader);
    if (sess) return { authorized: true, session: sess };
    return { authorized: false, session: null, reason: 'Invalid or expired Bearer token in Authorization header' };
  }

  const wsProto = req.headers['sec-websocket-protocol'];
  if (typeof wsProto === 'string') {
    const parts = wsProto.split(',').map(p => p.trim());
    for (const part of parts) {
      if (part.startsWith('tok-') || part.startsWith('Bearer ')) {
        const sess = getAuthSessionFromToken(part);
        if (sess) return { authorized: true, session: sess };
        return { authorized: false, session: null, reason: 'Invalid or expired token in Sec-WebSocket-Protocol' };
      }
    }
  }

  const reqUrl = new URL(req.url || '/pty', 'http://localhost');
  const queryToken = reqUrl.searchParams.get('token');
  if (queryToken) {
    const sess = getAuthSessionFromToken(queryToken);
    if (sess) return { authorized: true, session: sess };
    return { authorized: false, session: null, reason: 'Invalid or expired session token' };
  }

  // If a formal/locked run is active or REQUIRE_WS_AUTH=true, reject unauthenticated WebSocket connections
  const isLocked = db.isFreezeStateLocked();
  if (isLocked || process.env.REQUIRE_WS_AUTH === 'true') {
    return {
      authorized: false,
      session: null,
      reason: 'Authenticated session token required for WebSocket terminal in locked research mode'
    };
  }

  return { authorized: true, session: null };
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
 * Explicit CORS Origin Allowlist Validator
 */
export function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : [];
  const defaults = [
    'http://localhost:2000',
    'http://127.0.0.1:2000',
    'http://localhost:2001',
    'http://127.0.0.1:2001',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ];
  return Array.from(new Set([...defaults, ...envOrigins]));
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // Same-origin or server-to-server request
  const allowlist = getAllowedOrigins();
  if (allowlist.includes(origin)) return true;
  if (process.env.NODE_ENV !== 'production' && (origin.endsWith('.run.app') || origin.startsWith('http://localhost:'))) {
    return true;
  }
  return false;
}

/**
 * Helmet-Equivalent HTTP Security Headers Middleware
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' ws: wss: http://localhost:* http://127.0.0.1:* https://*.googleapis.com;"
  );
  next();
}

/**
 * Strict Schema & Payload Size Validation Helper
 */
export interface FieldSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  maxLength?: number;
}

export function validatePayloadSchema(
  payload: any,
  schema: Record<string, FieldSchema>,
  options: { rejectUnknownFields?: boolean } = { rejectUnknownFields: true }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, errors: ['Request body must be a JSON object.'] };
  }

  if (options.rejectUnknownFields) {
    const allowedKeys = new Set(Object.keys(schema));
    for (const key of Object.keys(payload)) {
      if (!allowedKeys.has(key)) {
        errors.push(`Unknown field '${key}' is not permitted.`);
      }
    }
  }

  for (const [key, rule] of Object.entries(schema)) {
    const val = payload[key];
    if (val === undefined || val === null) {
      if (rule.required) {
        errors.push(`Missing required field '${key}'.`);
      }
      continue;
    }

    if (rule.type === 'array') {
      if (!Array.isArray(val)) {
        errors.push(`Field '${key}' must be an array.`);
      } else if (rule.maxLength && val.length > rule.maxLength) {
        errors.push(`Field '${key}' exceeds maximum array length of ${rule.maxLength}.`);
      }
    } else if (typeof val !== rule.type) {
      errors.push(`Field '${key}' must be of type ${rule.type}.`);
    } else if (rule.type === 'string' && rule.maxLength && val.length > rule.maxLength) {
      errors.push(`Field '${key}' exceeds maximum string length of ${rule.maxLength}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Sanitizes error messages in production so stack traces, flags, filesystem paths, and credentials never leak.
 */
export function sanitizeProductionError(err: any): string {
  const rawMsg = typeof err === 'string' ? err : err?.message || 'Internal Server Error';
  return rawMsg
    .replace(/FLAG\{[^}]+\}/gi, 'FLAG{[REDACTED]}')
    .replace(/scrypt\$[a-f0-9]+\$[a-f0-9]+/gi, '[REDACTED_HASH]')
    .replace(/\/home\/[a-zA-Z0-9_-]+\/[^\s:]+/g, '[REDACTED_PATH]');
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
  if (db.isFreezeStateLocked()) {
    const gov = db.getGovernanceState();
    return res.status(403).json({
      error: `FROZEN_PHASE_IMMUTABLE: Cannot mutate configuration, task catalog, or protocol settings while research state '${gov.currentState}' is locked.`
    });
  }
  next();
}

/**
 * Sliding-window in-memory rate limiter per IP + endpoint group.
 */
const rateLimitBuckets = new Map<string, number[]>();

export function resetRateLimitBuckets(): void {
  rateLimitBuckets.clear();
}

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
