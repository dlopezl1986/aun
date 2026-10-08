#!/usr/bin/env node
/**
 * AUN local server (development / self-hosted on your own computer).
 *
 * Implements the small subset of the Supabase REST API that the app uses
 * (src/services/backend/supabase.ts), so every browser and device that can
 * reach this computer shares the same accounts and data:
 *   - Auth:  POST /auth/v1/signup · POST /auth/v1/token?grant_type=password|refresh_token
 *            GET|PUT /auth/v1/user · POST /auth/v1/logout · POST /auth/v1/recover
 *   - Data:  GET /rest/v1/records · POST /rest/v1/rpc/sync_push
 *
 * Security: passwords are hashed with scrypt + per-user salt (never stored in
 * plain text); access tokens are random, expire in 1 h and refresh tokens
 * rotate; every record is scoped to its owner. Data lives in server/data/db.json
 * (git-ignored). For production use the real backend (docs/BACKEND.md).
 *
 * Usage: node server/aun-local-server.mjs [--port 8091]
 * No dependencies (Node ≥ 18).
 */
import { createServer } from 'node:http';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.argv[process.argv.indexOf('--port') + 1]) || Number(process.env.AUN_SERVER_PORT) || 8091;
const DATA_FILE = process.env.AUN_SERVER_DATA ?? join(dirname(fileURLToPath(import.meta.url)), 'data', 'db.json');
const ACCESS_TTL_S = 3600;
const MIN_PASSWORD = 8;

// ---------- Storage (one JSON file, atomic writes) ----------

function load() {
  if (!existsSync(DATA_FILE)) return { users: [], sessions: [], records: [] };
  return JSON.parse(readFileSync(DATA_FILE, 'utf8'));
}
let db = load();
function save() {
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(db));
  renameSync(tmp, DATA_FILE);
}

// ---------- Helpers ----------

const now = () => new Date().toISOString();
const normalizeLogin = (v) => String(v ?? '').trim().toLowerCase();
const isLogin = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || /^[a-z0-9][a-z0-9._-]{2,29}$/.test(v);

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') };
}
function checkPassword(password, user) {
  const { hash } = hashPassword(password, user.salt);
  return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
}

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  created_at: u.created_at,
  user_metadata: u.user_metadata ?? {},
  app_metadata: { provider: 'email', providers: ['email'] },
});

function issueSession(user) {
  const session = {
    access_token: randomBytes(32).toString('base64url'),
    refresh_token: randomBytes(32).toString('base64url'),
    user_id: user.id,
    expires_at: Math.floor(Date.now() / 1000) + ACCESS_TTL_S,
  };
  db.sessions.push(session);
  // Drop expired access tokens whose refresh token is gone (housekeeping).
  db.sessions = db.sessions.slice(-500);
  save();
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: 'bearer',
    expires_in: ACCESS_TTL_S,
    expires_at: session.expires_at,
    user: publicUser(user),
  };
}

function authUser(req) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  const s = db.sessions.find((x) => x.access_token === token);
  if (!s || s.expires_at * 1000 < Date.now()) return null;
  return db.users.find((u) => u.id === s.user_id) ?? null;
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}
const fail = (res, status, code, msg) => send(res, status, { error_code: code, msg });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 10 * 1024 * 1024) reject(new Error('too large'));
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

// ---------- Routes ----------

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  if (req.method === 'GET' && path === '/health') return send(res, 200, { ok: true, users: db.users.length });

  if (req.method === 'POST' && path === '/auth/v1/signup') {
    const body = await readBody(req);
    const email = normalizeLogin(body.email);
    if (!isLogin(email)) return fail(res, 422, 'email_address_invalid', 'Invalid email or username');
    if (String(body.password ?? '').length < MIN_PASSWORD) return fail(res, 422, 'weak_password', 'Password should be at least 8 characters');
    if (db.users.some((u) => u.email === email)) return fail(res, 422, 'user_already_exists', 'User already registered');
    const { salt, hash } = hashPassword(String(body.password));
    const user = { id: randomUUID(), email, salt, hash, created_at: now(), user_metadata: body.data ?? {} };
    db.users.push(user);
    save();
    return send(res, 200, issueSession(user));
  }

  if (req.method === 'POST' && path === '/auth/v1/token') {
    const body = await readBody(req);
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const user = db.users.find((u) => u.email === normalizeLogin(body.email));
      const ok = user ? checkPassword(String(body.password ?? ''), user) : (hashPassword(String(body.password ?? '')), false);
      if (!user || !ok) return fail(res, 400, 'invalid_credentials', 'Invalid login credentials');
      return send(res, 200, issueSession(user));
    }
    if (grant === 'refresh_token') {
      const s = db.sessions.find((x) => x.refresh_token === body.refresh_token);
      const user = s && db.users.find((u) => u.id === s.user_id);
      if (!s || !user) return fail(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token');
      db.sessions = db.sessions.filter((x) => x !== s); // rotation: old refresh token dies
      return send(res, 200, issueSession(user));
    }
    return fail(res, 400, 'unsupported_grant_type', 'Unsupported grant type');
  }

  if (path === '/auth/v1/user') {
    const user = authUser(req);
    if (!user) return fail(res, 401, 'bad_jwt', 'Not signed in');
    if (req.method === 'PUT') {
      const body = await readBody(req);
      user.user_metadata = { ...user.user_metadata, ...(body.data ?? {}) };
      save();
    }
    return send(res, 200, publicUser(user));
  }

  if (req.method === 'POST' && path === '/auth/v1/logout') {
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    db.sessions = db.sessions.filter((x) => x.access_token !== token);
    save();
    return send(res, 204);
  }

  if (req.method === 'POST' && path === '/auth/v1/recover') {
    // No mail server here: same answer whether the account exists or not.
    return send(res, 200, {});
  }

  if (req.method === 'GET' && path === '/rest/v1/records') {
    const user = authUser(req);
    if (!user) return fail(res, 401, 'bad_jwt', 'Not signed in');
    const filter = url.searchParams.get('server_updated_at');
    const since = filter?.startsWith('gt.') ? filter.slice(3) : null;
    const limit = Math.min(Number(url.searchParams.get('limit')) || 500, 1000);
    const rows = db.records
      .filter((r) => r.user_id === user.id && (!since || r.server_updated_at > since))
      .sort((a, b) => a.server_updated_at.localeCompare(b.server_updated_at))
      .slice(0, limit)
      .map(({ user_id: _u, ...r }) => r);
    return send(res, 200, rows);
  }

  if (req.method === 'POST' && path === '/rest/v1/rpc/sync_push') {
    const user = authUser(req);
    if (!user) return fail(res, 401, 'bad_jwt', 'Not signed in');
    const body = await readBody(req);
    const records = Array.isArray(body.records) ? body.records : [];
    if (records.length > 500) return fail(res, 400, 'too_many', 'records must be an array of at most 500 rows');
    let applied = 0;
    for (const r of records) {
      if (!/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(r.collection ?? '') || !r.id) continue;
      const i = db.records.findIndex((x) => x.user_id === user.id && x.collection === r.collection && x.id === r.id);
      // Last write wins (same rule as supabase/migrations).
      if (i >= 0 && db.records[i].updated_at > r.updated_at) continue;
      // Strictly increasing server cursor, even within the same millisecond.
      const stamp = new Date(Math.max(Date.now(), lastStamp + 1));
      lastStamp = stamp.getTime();
      const row = {
        user_id: user.id,
        collection: r.collection,
        id: String(r.id),
        data: r.data,
        updated_at: r.updated_at,
        deleted_at: r.deleted_at ?? null,
        server_updated_at: stamp.toISOString(),
      };
      if (i >= 0) db.records[i] = row;
      else db.records.push(row);
      applied += 1;
    }
    save();
    return send(res, 200, applied);
  }

  return fail(res, 404, 'not_found', 'Not found');
}
let lastStamp = 0;

const server = createServer(async (req, res) => {
  // The web app runs on another port (and other devices on the LAN): allow CORS.
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  if (req.method === 'OPTIONS') return send(res, 204);
  try {
    await handle(req, res);
  } catch (e) {
    fail(res, 400, 'bad_request', e instanceof Error ? e.message : 'Bad request');
  }
});

server.listen(PORT, () => {
  console.log(`AUN local server on http://localhost:${PORT} · data: ${DATA_FILE} · users: ${db.users.length}`);
});
