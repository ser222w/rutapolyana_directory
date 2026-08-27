/**
 * Доменна модель бронювання — незалежна від конкретної CRM.
 * Кожен адаптер (mock, rest, ...) перекладає формат своєї CRM у ці типи.
 */

export interface AvailabilityQuery {
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  adults: number;
  children?: number;
  childrenAges?: number[];
  promoCode?: string;
}

export interface RoomOffer {
  roomTypeId: string;
  roomTypeName: string;
  ratePlanId: string;
  ratePlanName: string;
  mealPlan: string;
  maxOccupancy: number;
  bedding: string;
  sizeSqm?: number;
  amenities: string[];
  nights: number;
  pricePerNight: number;
  totalPrice: number;
  currency: string;
  refundable: boolean;
  cancellationPolicy: string;
  roomsLeft: number;
}

export interface RoomType {
  roomTypeId: string;
  name: string;
  description: string;
  maxOccupancy: number;
  bedding: string;
  sizeSqm?: number;
  amenities: string[];
  photos: string[];
}

export interface Guest {
  fullName: string;
  phone: string;
  email?: string;
}

export interface CreateBookingInput extends AvailabilityQuery {
  roomTypeId: string;
  ratePlanId: string;
  guest: Guest;
  comment?: string;
  /** Звідки прийшов запит — для аналітики в CRM. */
  source: string;
}

export type BookingStatus =
  | 'pending' // запит створено, чекає підтвердження рецепції/оплати
  | 'confirmed'
  | 'cancelled'
  | 'expired';

export interface Booking {
  confirmationCode: string;
  status: BookingStatus;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  roomTypeId: string;
  roomTypeName: string;
  ratePlanName: string;
  mealPlan: string;
  totalPrice: number;
  currency: string;
  guest: Guest;
  comment?: string;
  cancellationPolicy: string;
  /** Посилання на оплату/підтвердження — гість відкриває його сам у браузері. */
  paymentUrl?: string;
  createdAt: string;
  holdExpiresAt?: string;
}

export interface CrmAdapter {
  readonly name: string;
  searchAvailability(query: AvailabilityQuery): Promise<RoomOffer[]>;
  listRoomTypes(): Promise<RoomType[]>;
  createBooking(input: CreateBookingInput): Promise<Booking>;
  getBooking(confirmationCode: string, phone: string): Promise<Booking | null>;
  cancelBooking(confirmationCode: string, phone: string, reason?: string): Promise<Booking>;
}

/** Помилка, текст якої безпечно показати гостю в чаті. */
export class CrmError extends Error {
  constructor(
    message: string,
    readonly code: 'not_found' | 'unavailable' | 'invalid' | 'upstream' = 'invalid'
  ) {
    super(message);
    this.name = 'CrmError';
  }
}
