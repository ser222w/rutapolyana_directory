/**
 * Конфігурація сервера. Усе через env — жодних секретів у коді.
 */

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: num(process.env.PORT, 8787),
  host: process.env.HOST ?? '0.0.0.0',

  hotel: {
    name: process.env.HOTEL_NAME ?? 'Ruta Resort Polyana',
    site: process.env.HOTEL_SITE ?? 'https://rutapolyana.com',
    phone: process.env.HOTEL_PHONE ?? '+380 67 265 74 00',
    email: process.env.HOTEL_EMAIL ?? 'polyana@rutahnr.com',
    currency: process.env.HOTEL_CURRENCY ?? 'UAH',
    timezone: process.env.HOTEL_TIMEZONE ?? 'Europe/Kyiv',
  },

  /** mock — демо-дані; rest — реальна CRM через HTTP. */
  crmProvider: (process.env.CRM_PROVIDER ?? 'mock') as 'mock' | 'rest',

  crm: {
    baseUrl: process.env.CRM_BASE_URL ?? '',
    apiKey: process.env.CRM_API_KEY ?? '',
    /** Заголовок авторизації CRM: 'Authorization: Bearer' | 'X-Api-Key' тощо. */
    authHeader: process.env.CRM_AUTH_HEADER ?? 'Authorization',
    authScheme: process.env.CRM_AUTH_SCHEME ?? 'Bearer',
    hotelId: process.env.CRM_HOTEL_ID ?? '',
    timeoutMs: num(process.env.CRM_TIMEOUT_MS, 12_000),
  },

  /** Ліміт запитів на IP (щоб публічний MCP не задовбали). */
  rateLimit: {
    windowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: num(process.env.RATE_LIMIT_MAX, 60),
  },

  /** Максимальна глибина бронювання наперед, днів. */
  maxAdvanceDays: num(process.env.MAX_ADVANCE_DAYS, 400),
  maxNights: num(process.env.MAX_NIGHTS, 30),
};

export type Config = typeof config;
