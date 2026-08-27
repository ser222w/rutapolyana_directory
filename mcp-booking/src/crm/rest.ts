import { config } from '../config.js';
import {
  AvailabilityQuery,
  Booking,
  CreateBookingInput,
  CrmAdapter,
  CrmError,
  RoomOffer,
  RoomType,
} from './types.js';
import { normalizePhone } from './util.js';

/**
 * Адаптер до реальної CRM/PMS готелю.
 *
 * Він говорить із CRM за простим HTTP-контрактом (див. README, розділ «Контракт CRM»).
 * Якщо ваша CRM має інші назви полів — міняєте ТІЛЬКИ функції map* нижче,
 * решта сервера лишається незмінною.
 */

interface RawResponse {
  [key: string]: unknown;
}

async function callCrm<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!config.crm.baseUrl) {
    throw new CrmError('CRM_BASE_URL не налаштовано на сервері.', 'upstream');
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (config.crm.apiKey) {
    headers[config.crm.authHeader] = config.crm.authScheme
      ? `${config.crm.authScheme} ${config.crm.apiKey}`
      : config.crm.apiKey;
  }
  if (config.crm.hotelId) {
    headers['X-Hotel-Id'] = config.crm.hotelId;
  }

  const url = new URL(path.replace(/^\//, ''), config.crm.baseUrl.replace(/\/?$/, '/'));
  const response = await fetch(url, {
    ...init,
    headers,
    signal: AbortSignal.timeout(config.crm.timeoutMs),
  }).catch((error: unknown) => {
    throw new CrmError(
      `Не вдалося зв'язатися із системою бронювання готелю (${(error as Error).message}). Спробуйте пізніше або зателефонуйте на рецепцію.`,
      'upstream'
    );
  });

  if (response.status === 404) {
    throw new CrmError('Не знайдено.', 'not_found');
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new CrmError(
      `Система бронювання повернула помилку ${response.status}. ${body.slice(0, 200)}`.trim(),
      'upstream'
    );
  }
  return (await response.json()) as T;
}

// ─── Мапінг: єдине місце, яке правиться під конкретну CRM ────────────────────

function mapOffer(raw: RawResponse): RoomOffer {
  const nights = Number(raw.nights ?? 1);
  const pricePerNight = Number(raw.price_per_night ?? raw.pricePerNight ?? 0);
  return {
    roomTypeId: String(raw.room_type_id ?? raw.roomTypeId),
    roomTypeName: String(raw.room_type_name ?? raw.roomTypeName ?? ''),
    ratePlanId: String(raw.rate_plan_id ?? raw.ratePlanId ?? 'default'),
    ratePlanName: String(raw.rate_plan_name ?? raw.ratePlanName ?? 'Базовий тариф'),
    mealPlan: String(raw.meal_plan ?? raw.mealPlan ?? 'Без харчування'),
    maxOccupancy: Number(raw.max_occupancy ?? raw.maxOccupancy ?? 2),
    bedding: String(raw.bedding ?? ''),
    sizeSqm: raw.size_sqm != null ? Number(raw.size_sqm) : undefined,
    amenities: Array.isArray(raw.amenities) ? raw.amenities.map(String) : [],
    nights,
    pricePerNight,
    totalPrice: Number(raw.total_price ?? raw.totalPrice ?? pricePerNight * nights),
    currency: String(raw.currency ?? config.hotel.currency),
    refundable: raw.refundable !== false,
    cancellationPolicy: String(raw.cancellation_policy ?? raw.cancellationPolicy ?? ''),
    roomsLeft: Number(raw.rooms_left ?? raw.roomsLeft ?? 1),
  };
}

function mapRoomType(raw: RawResponse): RoomType {
  return {
    roomTypeId: String(raw.room_type_id ?? raw.id),
    name: String(raw.name ?? ''),
    description: String(raw.description ?? ''),
    maxOccupancy: Number(raw.max_occupancy ?? raw.maxOccupancy ?? 2),
    bedding: String(raw.bedding ?? ''),
    sizeSqm: raw.size_sqm != null ? Number(raw.size_sqm) : undefined,
    amenities: Array.isArray(raw.amenities) ? raw.amenities.map(String) : [],
    photos: Array.isArray(raw.photos) ? raw.photos.map(String) : [],
  };
}

function mapBooking(raw: RawResponse): Booking {
  const guest = (raw.guest ?? {}) as RawResponse;
  return {
    confirmationCode: String(raw.confirmation_code ?? raw.confirmationCode ?? raw.id),
    status: (String(raw.status ?? 'pending') as Booking['status']),
    checkIn: String(raw.check_in ?? raw.checkIn),
    checkOut: String(raw.check_out ?? raw.checkOut),
    nights: Number(raw.nights ?? 1),
    adults: Number(raw.adults ?? 1),
    children: Number(raw.children ?? 0),
    roomTypeId: String(raw.room_type_id ?? raw.roomTypeId ?? ''),
    roomTypeName: String(raw.room_type_name ?? raw.roomTypeName ?? ''),
    ratePlanName: String(raw.rate_plan_name ?? raw.ratePlanName ?? ''),
    mealPlan: String(raw.meal_plan ?? raw.mealPlan ?? ''),
    totalPrice: Number(raw.total_price ?? raw.totalPrice ?? 0),
    currency: String(raw.currency ?? config.hotel.currency),
    guest: {
      fullName: String(guest.full_name ?? guest.fullName ?? ''),
      phone: String(guest.phone ?? ''),
      email: guest.email ? String(guest.email) : undefined,
    },
    comment: raw.comment ? String(raw.comment) : undefined,
    cancellationPolicy: String(raw.cancellation_policy ?? raw.cancellationPolicy ?? ''),
    paymentUrl: raw.payment_url ? String(raw.payment_url) : undefined,
    createdAt: String(raw.created_at ?? raw.createdAt ?? new Date().toISOString()),
    holdExpiresAt: raw.hold_expires_at ? String(raw.hold_expires_at) : undefined,
  };
}

// ─── Адаптер ─────────────────────────────────────────────────────────────────

export class RestCrmAdapter implements CrmAdapter {
  readonly name = 'rest';

  async searchAvailability(query: AvailabilityQuery): Promise<RoomOffer[]> {
    const params = new URLSearchParams({
      check_in: query.checkIn,
      check_out: query.checkOut,
      adults: String(query.adults),
      children: String(query.children ?? 0),
    });
    if (query.childrenAges?.length) params.set('children_ages', query.childrenAges.join(','));
    if (query.promoCode) params.set('promo_code', query.promoCode);

    const data = await callCrm<{ offers?: RawResponse[] }>(`availability?${params}`);
    return (data.offers ?? []).map(mapOffer).sort((a, b) => a.totalPrice - b.totalPrice);
  }

  async listRoomTypes(): Promise<RoomType[]> {
    const data = await callCrm<{ room_types?: RawResponse[]; roomTypes?: RawResponse[] }>('room-types');
    return (data.room_types ?? data.roomTypes ?? []).map(mapRoomType);
  }

  async createBooking(input: CreateBookingInput): Promise<Booking> {
    const data = await callCrm<RawResponse>('bookings', {
      method: 'POST',
      body: JSON.stringify({
        check_in: input.checkIn,
        check_out: input.checkOut,
        adults: input.adults,
        children: input.children ?? 0,
        children_ages: input.childrenAges ?? [],
        room_type_id: input.roomTypeId,
        rate_plan_id: input.ratePlanId,
        promo_code: input.promoCode,
        comment: input.comment,
        source: input.source,
        guest: {
          full_name: input.guest.fullName,
          phone: normalizePhone(input.guest.phone),
          email: input.guest.email,
        },
      }),
    });
    return mapBooking(data);
  }

  async getBooking(confirmationCode: string, phone: string): Promise<Booking | null> {
    const params = new URLSearchParams({ phone: normalizePhone(phone) });
    try {
      const data = await callCrm<RawResponse>(
        `bookings/${encodeURIComponent(confirmationCode.trim().toUpperCase())}?${params}`
      );
      return mapBooking(data);
    } catch (error) {
      if (error instanceof CrmError && error.code === 'not_found') return null;
      throw error;
    }
  }

  async cancelBooking(confirmationCode: string, phone: string, reason?: string): Promise<Booking> {
    const data = await callCrm<RawResponse>(
      `bookings/${encodeURIComponent(confirmationCode.trim().toUpperCase())}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify({ phone: normalizePhone(phone), reason }),
      }
    );
    return mapBooking(data);
  }
}
