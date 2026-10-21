/** Вход по паролю: сессия в cookie, пароль сравнивается без утечки времени. */

import { createHmac, timingSafeEqual } from 'node:crypto';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const SESSION_COOKIE = 'workshop_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Сравнение строк за постоянное время. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    // Длину всё равно сравниваем — чтобы не отличать по времени отказ.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export interface AuthOptions {
  password: string;
  secret: string;
  enabled: boolean;
}

export function registerAuth(app: FastifyInstance, options: AuthOptions): void {
  const { password, secret, enabled } = options;

  if (!enabled) {
    // Пароль не задан — приложение открыто.
    app.addHook('onRequest', async (request) => {
      (request as FastifyRequest & { session?: unknown }).session = { auth: true };
    });
    return;
  }

  app.post('/api/login', async (request, reply) => {
    const body = (request.body ?? {}) as { password?: string };
    if (!safeEqual(body.password ?? '', password)) {
      return reply.code(401).send({ error: 'Неверный пароль' });
    }
    reply.setCookie(SESSION_COOKIE, signToken(secret), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
    return { ok: true };
  });

  app.post('/api/logout', async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/session', async (request) => {
    const token = request.cookies[SESSION_COOKIE];
    return { authenticated: verifyToken(secret, token) };
  });

  // Остальные маршруты — только с верным токеном.
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/api/login') || request.url.startsWith('/api/session')) {
      return;
    }
    const token = request.cookies[SESSION_COOKIE];
    if (!verifyToken(secret, token)) {
      return reply.code(401).send({ error: 'Требуется вход' });
    }
  });
}

/** Подпись токена: base64(срок) + подпись HMAC. */
function signToken(secret: string): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(String(expires)).toString('base64url');
  return `${payload}.${signature(secret, payload)}`;
}

/** Проверка подписи и срока действия. */
function verifyToken(secret: string, token?: string): boolean {
  if (!token) return false;
  const [payload, mac] = token.split('.');
  if (!payload || !mac) return false;
  if (!safeEqual(mac, signature(secret, payload))) return false;
  const expires = Number(Buffer.from(payload, 'base64url').toString());
  return Number.isFinite(expires) && expires > Date.now();
}

function signature(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}
