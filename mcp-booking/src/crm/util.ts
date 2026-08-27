import { config } from '../config.js';
import { CrmError } from './types.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDate(value: string, field: string): Date {
  if (!DATE_RE.test(value)) {
    throw new CrmError(`Дата «${field}» має бути у форматі YYYY-MM-DD (наприклад 2026-09-15).`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new CrmError(`Дата «${field}» не існує: ${value}.`);
  }
  return date;
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const from = parseDate(checkIn, 'check_in');
  const to = parseDate(checkOut, 'check_out');
  const nights = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  if (nights < 1) {
    throw new CrmError('Дата виїзду має бути пізнішою за дату заїзду щонайменше на одну добу.');
  }
  return nights;
}

/** Валідація, спільна для пошуку й бронювання. Кидає зрозумілі гостю помилки. */
export function validateStay(checkIn: string, checkOut: string): number {
  const nights = nightsBetween(checkIn, checkOut);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const from = parseDate(checkIn, 'check_in');

  if (from.getTime() < today.getTime()) {
    throw new CrmError('Дата заїзду вже в минулому. Вкажіть майбутню дату.');
  }
  const advanceDays = Math.round((from.getTime() - today.getTime()) / 86_400_000);
  if (advanceDays > config.maxAdvanceDays) {
    throw new CrmError(`Бронювання відкрите максимум на ${config.maxAdvanceDays} днів наперед.`);
  }
  if (nights > config.maxNights) {
    throw new CrmError(`Максимальна тривалість онлайн-бронювання — ${config.maxNights} ночей.`);
  }
  return nights;
}

/** Український формат: +380XXXXXXXXX. Використовується як легкий «пароль» до броні. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `+38${digits}`;
  if (digits.length === 12 && digits.startsWith('380')) return `+${digits}`;
  if (digits.length >= 8) return `+${digits}`;
  throw new CrmError('Номер телефону виглядає некоректним. Приклад: +380671234567.');
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export function money(amount: number, currency: string): string {
  return `${amount.toLocaleString('uk-UA')} ${currency}`;
}
