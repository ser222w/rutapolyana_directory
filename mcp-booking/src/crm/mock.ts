import { randomUUID } from 'node:crypto';
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
import { nightsBetween, normalizePhone } from './util.js';

/**
 * Демо-адаптер: реалістичні дані Ruta Resort Polyana без підключення до CRM.
 * Потрібен, щоб MCP-сервер можна було підключити й протестувати в Claude/ChatGPT
 * ще до того, як готель видасть доступ до API.
 */

const ROOM_TYPES: (RoomType & {
  basePrice: number;
  ratePlans: { id: string; name: string; mealPlan: string; multiplier: number; refundable: boolean }[];
  inventory: number;
})[] = [
  {
    roomTypeId: 'std-dbl',
    name: 'Standard Double',
    description:
      'Затишний номер із видом на гори або внутрішній двір. Ідеально для пари на коротку відпустку.',
    maxOccupancy: 2,
    bedding: '1 двоспальне ліжко або 2 односпальні',
    sizeSqm: 22,
    amenities: ['Wi-Fi', 'Кондиціонер', 'Телевізор', 'Санвузол з душем', 'Фен', 'Сейф'],
    photos: [`${config.hotel.site}/rooms/standard`],
    basePrice: 3200,
    inventory: 12,
    ratePlans: [
      { id: 'bb', name: 'Сніданок включено', mealPlan: 'Сніданок (шведський стіл)', multiplier: 1, refundable: true },
      { id: 'hb', name: 'Напівпансіон', mealPlan: 'Сніданок + вечеря', multiplier: 1.25, refundable: true },
      { id: 'nonref', name: 'Невідмінний тариф −12%', mealPlan: 'Сніданок (шведський стіл)', multiplier: 0.88, refundable: false },
    ],
  },
  {
    roomTypeId: 'superior-dbl',
    name: 'Superior Double',
    description: 'Просторіший номер із балконом і панорамним видом на Полянську долину.',
    maxOccupancy: 3,
    bedding: '1 двоспальне ліжко + додаткове місце',
    sizeSqm: 30,
    amenities: ['Wi-Fi', 'Балкон', 'Кондиціонер', 'Міні-бар', 'Халати', 'Сейф'],
    photos: [`${config.hotel.site}/rooms/superior`],
    basePrice: 4300,
    inventory: 8,
    ratePlans: [
      { id: 'bb', name: 'Сніданок включено', mealPlan: 'Сніданок (шведський стіл)', multiplier: 1, refundable: true },
      { id: 'hb', name: 'Напівпансіон', mealPlan: 'Сніданок + вечеря', multiplier: 1.22, refundable: true },
    ],
  },
  {
    roomTypeId: 'family',
    name: 'Family Suite',
    description:
      'Дві кімнати для родини з дітьми. Поруч дитячий клуб та аква-зона, включені в проживання.',
    maxOccupancy: 4,
    bedding: '1 двоспальне + 2 односпальні',
    sizeSqm: 45,
    amenities: ['Wi-Fi', '2 кімнати', 'Кондиціонер', 'Дитяче ліжечко на запит', 'Міні-кухня'],
    photos: [`${config.hotel.site}/rooms/family`],
    basePrice: 6100,
    inventory: 5,
    ratePlans: [
      { id: 'bb', name: 'Сніданок включено', mealPlan: 'Сніданок (шведський стіл)', multiplier: 1, refundable: true },
      { id: 'hb', name: 'Напівпансіон', mealPlan: 'Сніданок + вечеря', multiplier: 1.2, refundable: true },
    ],
  },
  {
    roomTypeId: 'lux',
    name: 'Lux Panorama',
    description: 'Люкс із гідромасажною ванною, окремою вітальнею та найкращим видом на Карпати.',
    maxOccupancy: 2,
    bedding: '1 king-size ліжко',
    sizeSqm: 52,
    amenities: ['Wi-Fi', 'Гідромасажна ванна', 'Вітальня', 'Балкон', 'Міні-бар', 'Кавомашина'],
    photos: [`${config.hotel.site}/rooms/lux`],
    basePrice: 8400,
    inventory: 3,
    ratePlans: [
      { id: 'bb', name: 'Сніданок включено', mealPlan: 'Сніданок (шведський стіл)', multiplier: 1, refundable: true },
      { id: 'wellness', name: 'Wellness-пакет', mealPlan: 'Сніданок + чан на 2 особи', multiplier: 1.35, refundable: true },
    ],
  },
];

const REFUNDABLE_POLICY = 'Безкоштовне скасування не пізніше ніж за 7 днів до заїзду.';
const NONREF_POLICY = 'Тариф без повернення: суму не повертаємо при скасуванні.';

/** Детермінований «сезонний» коефіцієнт — вихідні та зима дорожчі. */
function seasonMultiplier(date: string): number {
  const d = new Date(`${date}T00:00:00Z`);
  const month = d.getUTCMonth() + 1;
  const weekend = [5, 6].includes(d.getUTCDay());
  const high = [1, 2, 7, 8, 12].includes(month) ? 1.18 : 1;
  return high * (weekend ? 1.1 : 1);
}

/** Псевдовипадкова, але стабільна зайнятість — той самий запит дає ту саму відповідь. */
function hash(input: string): number {
  let h = 2166136261;
  for (const ch of input) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const bookings = new Map<string, Booking>();

function makeCode(): string {
  return `RP-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export class MockCrmAdapter implements CrmAdapter {
  readonly name = 'mock';

  async searchAvailability(query: AvailabilityQuery): Promise<RoomOffer[]> {
    const nights = nightsBetween(query.checkIn, query.checkOut);
    const guests = query.adults + (query.children ?? 0);
    const promoDiscount = query.promoCode?.trim().toUpperCase() === 'RUTA10' ? 0.9 : 1;
    const season = seasonMultiplier(query.checkIn);

    const offers: RoomOffer[] = [];
    for (const room of ROOM_TYPES) {
      if (room.maxOccupancy < guests) continue;

      const roomsLeft = hash(`${room.roomTypeId}:${query.checkIn}`) % (room.inventory + 1);
      if (roomsLeft === 0) continue;

      for (const plan of room.ratePlans) {
        const pricePerNight = Math.round((room.basePrice * plan.multiplier * season * promoDiscount) / 10) * 10;
        offers.push({
          roomTypeId: room.roomTypeId,
          roomTypeName: room.name,
          ratePlanId: plan.id,
          ratePlanName: plan.name,
          mealPlan: plan.mealPlan,
          maxOccupancy: room.maxOccupancy,
          bedding: room.bedding,
          sizeSqm: room.sizeSqm,
          amenities: room.amenities,
          nights,
          pricePerNight,
          totalPrice: pricePerNight * nights,
          currency: config.hotel.currency,
          refundable: plan.refundable,
          cancellationPolicy: plan.refundable ? REFUNDABLE_POLICY : NONREF_POLICY,
          roomsLeft,
        });
      }
    }
    return offers.sort((a, b) => a.totalPrice - b.totalPrice);
  }

  async listRoomTypes(): Promise<RoomType[]> {
    return ROOM_TYPES.map(({ basePrice, ratePlans, inventory, ...rest }) => rest);
  }

  async createBooking(input: CreateBookingInput): Promise<Booking> {
    const offers = await this.searchAvailability(input);
    const offer = offers.find(
      (o) => o.roomTypeId === input.roomTypeId && o.ratePlanId === input.ratePlanId
    );
    if (!offer) {
      throw new CrmError(
        'Цей номер або тариф уже недоступний на обрані дати. Спробуйте ще раз пошук наявності.',
        'unavailable'
      );
    }

    const code = makeCode();
    const now = new Date();
    const booking: Booking = {
      confirmationCode: code,
      status: 'pending',
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      nights: offer.nights,
      adults: input.adults,
      children: input.children ?? 0,
      roomTypeId: offer.roomTypeId,
      roomTypeName: offer.roomTypeName,
      ratePlanName: offer.ratePlanName,
      mealPlan: offer.mealPlan,
      totalPrice: offer.totalPrice,
      currency: offer.currency,
      guest: { ...input.guest, phone: normalizePhone(input.guest.phone) },
      comment: input.comment,
      cancellationPolicy: offer.cancellationPolicy,
      paymentUrl: `${config.hotel.site}/booking/confirm/${code}`,
      createdAt: now.toISOString(),
      holdExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    };
    bookings.set(code, booking);
    return booking;
  }

  async getBooking(confirmationCode: string, phone: string): Promise<Booking | null> {
    const booking = bookings.get(confirmationCode.trim().toUpperCase());
    if (!booking) return null;
    if (booking.guest.phone !== normalizePhone(phone)) return null;
    return booking;
  }

  async cancelBooking(confirmationCode: string, phone: string, reason?: string): Promise<Booking> {
    const booking = await this.getBooking(confirmationCode, phone);
    if (!booking) {
      throw new CrmError('Бронювання з таким кодом і номером телефону не знайдено.', 'not_found');
    }
    if (booking.status === 'cancelled') return booking;
    const cancelled: Booking = {
      ...booking,
      status: 'cancelled',
      comment: reason ? `${booking.comment ?? ''} | Причина скасування: ${reason}`.trim() : booking.comment,
    };
    bookings.set(cancelled.confirmationCode, cancelled);
    return cancelled;
  }
}
