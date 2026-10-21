/** Сборка Fastify-приложения: плагины, маршруты, раздача фронта. */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';

import { repoRoot, type Env } from './env.js';
import { registerAuth } from './auth.js';
import { registerClientRoutes } from './modules/clients/routes.js';
import { registerDocumentRoutes } from './modules/documents/routes.js';
import { registerFinanceRoutes } from './modules/finance/routes.js';
import { registerNotifyRoutes } from './modules/notify/routes.js';
import { registerOrderRoutes } from './modules/orders/routes.js';
import { registerSettingsRoutes } from './modules/settings/routes.js';
import { registerTaskRoutes } from './modules/tasks/routes.js';

export interface BuildOptions {
  env: Env;
  /** Каталог собранного фронта. Если его нет — отдаём заглушку. */
  webRoot?: string;
}

export async function buildApp(options: BuildOptions): Promise<FastifyInstance> {
  const { env } = options;
  const app = Fastify({
    logger: env.DEV
      ? { level: 'info' }
      : { level: 'info', transport: undefined },
    ajv: { customOptions: { removeAdditional: false } },
  });

  await app.register(cookie);

  registerAuth(app, {
    password: env.APP_PASSWORD,
    secret: env.SECRET_KEY || 'dev-secret-change-me',
    enabled: Boolean(env.APP_PASSWORD),
  });

  app.get('/api/health', async () => ({
    ok: true,
    version: '2.0.0',
    authEnabled: Boolean(env.APP_PASSWORD),
  }));

  await registerSettingsRoutes(app);
  await registerClientRoutes(app);
  await registerOrderRoutes(app);
  await registerDocumentRoutes(app);
  await registerFinanceRoutes(app);
  await registerNotifyRoutes(app);
  await registerTaskRoutes(app);

  // Собранный фронт: раздаём как статику, SPA-маршруты — на index.html.
  const webRoot = options.webRoot ?? resolve(repoRoot, 'apps/web/dist');
  if (existsSync(webRoot)) {
    await app.register(fastifyStatic, { root: webRoot, index: ['index.html'] });
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'Не найдено' });
      }
      return reply.sendFile('index.html');
    });
  } else {
    app.get('/', async () => ({
      ok: true,
      message: 'Фронт не собран. Выполните: npm run build',
    }));
  }

  return app;
}
