import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { config } from './config.js';
import { getCrm } from './crm/index.js';
import { CrmError, RoomOffer, Booking } from './crm/types.js';
import { isValidEmail, money, normalizePhone, validateStay } from './crm/util.js';
import { HOTEL_INFO, renderInfo, TOPICS, Topic } from './hotel-info.js';

const SOURCE = 'mcp-ai-agent';

// ─── Форматування відповідей для чату ────────────────────────────────────────

function formatOffers(offers: RoomOffer[], checkIn: string, checkOut: string): string {
  if (offers.length === 0) {
    return [
      `На ${checkIn} — ${checkOut} вільних номерів під цей запит немає.`,
      `Спробуйте інші дати або зателефонуйте на рецепцію: ${config.hotel.phone}.`,
    ].join('\n');
  }

  const lines = offers.map((o, i) => {
    const parts = [
      `${i + 1}. **${o.roomTypeName}** — ${o.ratePlanName}`,
      `   • ${money(o.totalPrice, o.currency)} за ${o.nights} ноч. (${money(o.pricePerNight, o.currency)}/ніч)`,
      `   • Харчування: ${o.mealPlan}`,
      `   • До ${o.maxOccupancy} гостей, ${o.bedding}${o.sizeSqm ? `, ${o.sizeSqm} м²` : ''}`,
      `   • ${o.refundable ? 'Можна скасувати' : 'Без повернення коштів'}: ${o.cancellationPolicy}`,
      `   • Залишилось номерів: ${o.roomsLeft}`,
      `   • Для бронювання: room_type_id="${o.roomTypeId}", rate_plan_id="${o.ratePlanId}"`,
    ];
    return parts.join('\n');
  });

  return [
    `Знайдено ${offers.length} варіант(ів) на ${checkIn} — ${checkOut}:`,
    '',
    ...lines,
    '',
    'Щоб забронювати — викличте create_booking з room_type_id і rate_plan_id обраного варіанта.',
  ].join('\n');
}

function formatBooking(b: Booking, isNew = false): string {
  const statusLabel: Record<Booking['status'], string> = {
    pending: 'Запит створено, очікує підтвердження готелю',
    confirmed: 'Підтверджено',
    cancelled: 'Скасовано',
    expired: 'Термін дії запиту минув',
  };

  const lines = [
    isNew ? '✅ Запит на бронювання створено.' : `Бронювання ${b.confirmationCode}`,
    '',
    `**Код бронювання: ${b.confirmationCode}**`,
    `Статус: ${statusLabel[b.status]}`,
    `Гість: ${b.guest.fullName}, ${b.guest.phone}${b.guest.email ? `, ${b.guest.email}` : ''}`,
    `Дати: ${b.checkIn} → ${b.checkOut} (${b.nights} ноч.)`,
    `Гостей: ${b.adults} дорослих${b.children ? `, ${b.children} дітей` : ''}`,
    `Номер: ${b.roomTypeName} — ${b.ratePlanName}`,
    `Харчування: ${b.mealPlan}`,
    `Сума: ${money(b.totalPrice, b.currency)}`,
    `Скасування: ${b.cancellationPolicy}`,
  ];

  if (b.comment) lines.push(`Коментар: ${b.comment}`);
  if (b.holdExpiresAt) lines.push(`Бронь тримається до: ${b.holdExpiresAt}`);
  if (b.paymentUrl && b.status === 'pending') {
    lines.push('', `👉 Підтвердити й оплатити: ${b.paymentUrl}`);
  }
  if (isNew) {
    lines.push(
      '',
      `Оплата не проводилась. Рецепція зв'яжеться з гостем для підтвердження, або можна подзвонити самому: ${config.hotel.phone}.`,
      'Збережіть код бронювання — він потрібен для перевірки та скасування.'
    );
  }
  return lines.join('\n');
}

/** Помилки CRM віддаємо як isError-результат, а не як кинутий виняток — щоб модель могла пояснити гостю. */
function toolError(error: unknown) {
  const message =
    error instanceof CrmError
      ? error.message
      : `Технічна помилка на боці готелю. Зателефонуйте на рецепцію: ${config.hotel.phone}.`;
  if (!(error instanceof CrmError)) {
    console.error('[mcp] unexpected error:', error);
  }
  return { isError: true, content: [{ type: 'text' as const, text: message }] };
}

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

// ─── Схеми аргументів ────────────────────────────────────────────────────────

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат дати: YYYY-MM-DD');

const staySchema = {
  check_in: dateField.describe('Дата заїзду, YYYY-MM-DD'),
  check_out: dateField.describe('Дата виїзду, YYYY-MM-DD'),
  adults: z.number().int().min(1).max(10).describe('Кількість дорослих'),
  children: z.number().int().min(0).max(8).optional().describe('Кількість дітей'),
  children_ages: z.array(z.number().int().min(0).max(17)).optional().describe('Вік кожної дитини'),
  promo_code: z.string().max(32).optional().describe('Промокод, якщо гість його має'),
};

// ─── Сервер ──────────────────────────────────────────────────────────────────

export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'rutapolyana-booking', version: '1.0.0' },
    {
      instructions: [
        `Це офіційний MCP-сервер готелю ${config.hotel.name} (${config.hotel.site}).`,
        'Через нього можна перевірити наявність номерів, дізнатись ціни, створити запит на бронювання,',
        'перевірити або скасувати вже створене бронювання, а також отримати довідку про готель.',
        '',
        'Правила роботи:',
        '1. Ціни та наявність беріть ЛИШЕ з search_availability — не вигадуйте й не згадуйте з пам’яті.',
        '2. Перед create_booking покажіть гостю підсумок (номер, тариф, дати, сума, умови скасування) і дочекайтесь явного «так».',
        '3. Ніколи не вигадуйте ім’я, телефон чи email гостя — запитайте їх.',
        '4. create_booking НЕ списує гроші: створюється запит зі статусом pending і посилання на оплату/підтвердження.',
        '5. Для перевірки або скасування броні потрібні код бронювання І телефон, вказаний при бронюванні.',
        `6. Якщо щось не вирішується інструментами — дайте контакт рецепції: ${config.hotel.phone}.`,
      ].join('\n'),
    }
  );

  const crm = getCrm();

  server.registerTool(
    'search_availability',
    {
      title: 'Пошук вільних номерів і цін',
      description:
        'Показує вільні номери, тарифи та актуальні ціни готелю на вказані дати. ' +
        'Завжди викликайте цей інструмент перед тим, як називати гостю будь-яку ціну.',
      inputSchema: staySchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        validateStay(args.check_in, args.check_out);
        const offers = await crm.searchAvailability({
          checkIn: args.check_in,
          checkOut: args.check_out,
          adults: args.adults,
          children: args.children,
          childrenAges: args.children_ages,
          promoCode: args.promo_code,
        });
        return ok(formatOffers(offers, args.check_in, args.check_out));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'list_room_types',
    {
      title: 'Категорії номерів',
      description:
        'Опис усіх категорій номерів готелю: місткість, ліжка, площа, зручності. Без цін і без наявності.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () => {
      try {
        const rooms = await crm.listRoomTypes();
        const text = rooms
          .map((r) =>
            [
              `**${r.name}** (id: ${r.roomTypeId})`,
              r.description,
              `До ${r.maxOccupancy} гостей · ${r.bedding}${r.sizeSqm ? ` · ${r.sizeSqm} м²` : ''}`,
              `Зручності: ${r.amenities.join(', ')}`,
            ].join('\n')
          )
          .join('\n\n');
        return ok(text || 'Категорії номерів наразі недоступні.');
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'create_booking',
    {
      title: 'Створити запит на бронювання',
      description:
        'Створює запит на бронювання в системі готелю. Гроші НЕ списуються — бронь отримує статус pending ' +
        'і посилання на підтвердження/оплату. Викликайте лише після того, як гість явно підтвердив ' +
        'номер, тариф, дати й суму, і надав своє ім’я та телефон.',
      inputSchema: {
        ...staySchema,
        room_type_id: z.string().min(1).describe('room_type_id з результату search_availability'),
        rate_plan_id: z.string().min(1).describe('rate_plan_id з результату search_availability'),
        guest_full_name: z.string().min(3).max(120).describe('Повне ім’я гостя, як він його назвав'),
        guest_phone: z.string().min(8).max(20).describe('Телефон гостя, напр. +380671234567'),
        guest_email: z.string().max(200).optional().describe('Email гостя (необов’язково)'),
        comment: z.string().max(500).optional().describe('Побажання гостя: ранній заїзд, дитяче ліжечко тощо'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        validateStay(args.check_in, args.check_out);
        if (args.guest_email && !isValidEmail(args.guest_email)) {
          throw new CrmError('Email виглядає некоректним. Перевірте адресу або пропустіть це поле.');
        }
        const booking = await crm.createBooking({
          checkIn: args.check_in,
          checkOut: args.check_out,
          adults: args.adults,
          children: args.children,
          childrenAges: args.children_ages,
          promoCode: args.promo_code,
          roomTypeId: args.room_type_id,
          ratePlanId: args.rate_plan_id,
          guest: {
            fullName: args.guest_full_name.trim(),
            phone: normalizePhone(args.guest_phone),
            email: args.guest_email,
          },
          comment: args.comment,
          source: SOURCE,
        });
        return ok(formatBooking(booking, true));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'get_booking',
    {
      title: 'Перевірити бронювання',
      description:
        'Показує деталі бронювання за кодом. Потрібен також телефон, вказаний при бронюванні — це підтвердження, що бронь належить гостю.',
      inputSchema: {
        confirmation_code: z.string().min(3).max(32).describe('Код бронювання, напр. RP-1A2B3C4D'),
        phone: z.string().min(8).max(20).describe('Телефон, вказаний при бронюванні'),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        const booking = await crm.getBooking(args.confirmation_code, args.phone);
        if (!booking) {
          return ok(
            'Бронювання з таким кодом і номером телефону не знайдено. ' +
              `Перевірте дані або зверніться на рецепцію: ${config.hotel.phone}.`
          );
        }
        return ok(formatBooking(booking));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'cancel_booking',
    {
      title: 'Скасувати бронювання',
      description:
        'Скасовує бронювання за кодом і телефоном. Перед викликом обов’язково перепитайте гостя, ' +
        'чи він точно хоче скасувати, і попередьте про умови скасування тарифу.',
      inputSchema: {
        confirmation_code: z.string().min(3).max(32).describe('Код бронювання'),
        phone: z.string().min(8).max(20).describe('Телефон, вказаний при бронюванні'),
        reason: z.string().max(300).optional().describe('Причина скасування (для готелю)'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const booking = await crm.cancelBooking(args.confirmation_code, args.phone, args.reason);
        return ok(`Бронювання скасовано.\n\n${formatBooking(booking)}`);
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'get_hotel_info',
    {
      title: 'Довідка про готель',
      description:
        'Інформація про готель: що включено в проживання, харчування, сервіси, wellness і чани, ' +
        'екскурсії, правила проживання, контакти й як доїхати.',
      inputSchema: {
        topic: z
          .enum(TOPICS)
          .optional()
          .describe(`Розділ довідки. Без параметра поверне всі: ${TOPICS.join(', ')}`),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => ok(renderInfo(args.topic as Topic | undefined)),
  );

  // Ресурс: коротка картка готелю, яку клієнт може підтягнути у контекст.
  server.registerResource(
    'hotel-overview',
    'hotel://rutapolyana/overview',
    {
      title: `${config.hotel.name} — про готель`,
      description: 'Довідка про готель одним документом',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/markdown',
          text: `# ${config.hotel.name}\n\n${renderInfo()}`,
        },
      ],
    })
  );

  // Готовий сценарій для гостя.
  server.registerPrompt(
    'plan_stay',
    {
      title: 'Підібрати відпочинок у Ruta Resort Polyana',
      description: 'Допомагає гостю обрати номер і забронювати відпочинок',
      argsSchema: {
        dates: z.string().describe('Бажані дати, напр. «12–15 вересня»'),
        guests: z.string().describe('Скільки гостей, напр. «2 дорослих і дитина 6 років»'),
      },
    },
    ({ dates, guests }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              `Хочу відпочити в ${config.hotel.name}. Дати: ${dates}. Гості: ${guests}.`,
              'Перевір наявність через search_availability, покажи 2–3 найкращі варіанти з цінами',
              'і підкажи, що включено в проживання. Нічого не бронюй без мого підтвердження.',
            ].join(' '),
          },
        },
      ],
    })
  );

  return server;
}

export { HOTEL_INFO };
