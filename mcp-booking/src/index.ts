import express, { type NextFunction, type Request, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { config } from './config.js';
import { getCrm } from './crm/index.js';
import { createMcpServer } from './mcp-server.js';

/**
 * HTTP-обгортка MCP-сервера.
 *
 * Режим stateless: на кожен запит створюємо новий MCP-сервер і транспорт.
 * Так сервер можна масштабувати горизонтально й хостити будь-де (Fly, Railway, VPS),
 * не зберігаючи сесії в пам'яті.
 */

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// CORS — потрібен браузерним MCP-клієнтам та MCP Inspector.
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'content-type, authorization, mcp-session-id, mcp-protocol-version, last-event-id'
  );
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id, mcp-protocol-version');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Простий rate limit на IP — публічний ендпоінт треба берегти.
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + config.rateLimit.windowMs });
    next();
    return;
  }
  entry.count += 1;
  if (entry.count > config.rateLimit.max) {
    res.status(429).json({
      jsonrpc: '2.0',
      error: { code: -32029, message: 'Забагато запитів. Спробуйте за хвилину.' },
      id: null,
    });
    return;
  }
  next();
}

// Прибирання застарілих записів rate limit.
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (entry.resetAt < now) hits.delete(key);
  }
}, 60_000);
cleanup.unref();

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', hotel: config.hotel.name, crm: getCrm().name });
});

// Публічна картка сервера — зручно давати гостям посилання.
app.get('/', (_req: Request, res: Response) => {
  res.type('text/plain').send(
    [
      `${config.hotel.name} — MCP-сервер бронювання`,
      '',
      'Підключення в Claude / ChatGPT:',
      `  URL: ${process.env.PUBLIC_URL ?? `http://localhost:${config.port}`}/mcp`,
      '  Транспорт: Streamable HTTP',
      '',
      `Сайт готелю: ${config.hotel.site}`,
      `Рецепція: ${config.hotel.phone}`,
    ].join('\n')
  );
});

app.post('/mcp', rateLimit, async (req: Request, res: Response) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on('close', () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('[mcp] request failed:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Внутрішня помилка сервера' },
        id: null,
      });
    }
  }
});

// У stateless-режимі SSE-стрім і закриття сесії не підтримуються.
const methodNotAllowed = (_req: Request, res: Response): void => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed. Використовуйте POST /mcp.' },
    id: null,
  });
};
app.get('/mcp', methodNotAllowed);
app.delete('/mcp', methodNotAllowed);

export { app };

// Запуск лише коли файл викликано напряму (у тестах імпортуємо app).
const isDirectRun = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (isDirectRun) {
  app.listen(config.port, config.host, () => {
    console.log(
      `[mcp] ${config.hotel.name} MCP server → http://${config.host}:${config.port}/mcp (CRM: ${getCrm().name})`
    );
  });
}
