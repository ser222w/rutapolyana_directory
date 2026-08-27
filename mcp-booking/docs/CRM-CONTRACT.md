# Контракт CRM для MCP-сервера бронювання

Документ для розробника CRM/PMS. Потрібні **4 HTTP-ендпоінти**.
MCP-сервер більше нічого від CRM не хоче.

- База: `CRM_BASE_URL`
- Авторизація: заголовок із `.env` (за замовчуванням `Authorization: Bearer <CRM_API_KEY>`)
- Формат: JSON, UTF-8. Дати — `YYYY-MM-DD`. Гроші — число в мінімальній валюті готелю (грн, не копійки).

Якщо назви полів у вашій CRM інші — це нормально: правляться функції `map*`
у `src/crm/rest.ts`, а не сама CRM.

---

## 1. `GET /availability` — наявність і ціни

**Query:** `check_in`, `check_out`, `adults`, `children`, `children_ages` (через кому), `promo_code`

**Відповідь:**

```json
{
  "offers": [
    {
      "room_type_id": "superior-dbl",
      "room_type_name": "Superior Double",
      "rate_plan_id": "bb",
      "rate_plan_name": "Сніданок включено",
      "meal_plan": "Сніданок (шведський стіл)",
      "max_occupancy": 3,
      "bedding": "1 двоспальне ліжко + додаткове місце",
      "size_sqm": 30,
      "amenities": ["Wi-Fi", "Балкон", "Міні-бар"],
      "nights": 3,
      "price_per_night": 4300,
      "total_price": 12900,
      "currency": "UAH",
      "refundable": true,
      "cancellation_policy": "Безкоштовне скасування за 7 днів до заїзду.",
      "rooms_left": 2
    }
  ]
}
```

Немає вільних номерів → `{"offers": []}` зі статусом 200.

---

## 2. `GET /room-types` — категорії номерів

```json
{
  "room_types": [
    {
      "room_type_id": "family",
      "name": "Family Suite",
      "description": "Дві кімнати для родини з дітьми.",
      "max_occupancy": 4,
      "bedding": "1 двоспальне + 2 односпальні",
      "size_sqm": 45,
      "amenities": ["Wi-Fi", "2 кімнати"],
      "photos": ["https://rutapolyana.com/rooms/family.jpg"]
    }
  ]
}
```

---

## 3. `POST /bookings` — створити бронь

**Тіло:**

```json
{
  "check_in": "2026-09-12",
  "check_out": "2026-09-15",
  "adults": 2,
  "children": 1,
  "children_ages": [6],
  "room_type_id": "family",
  "rate_plan_id": "bb",
  "promo_code": null,
  "comment": "Потрібне дитяче ліжечко",
  "source": "mcp-ai-agent",
  "guest": {
    "full_name": "Олена Ковальчук",
    "phone": "+380671234567",
    "email": "olena@example.com"
  }
}
```

**Відповідь — об'єкт броні (див. §5).** Статус має бути `pending`:
бронь потрапляє в CRM як запит, який підтверджує рецепція або оплата гостя.

`payment_url` — посилання, яке гість відкриє сам (сторінка підтвердження/оплати).
Якщо оплати онлайн немає — можна не передавати.

`source: "mcp-ai-agent"` варто зберігати окремим полем: так видно, скільки
броней приносить AI-канал.

---

## 4. `GET /bookings/{code}?phone=+380671234567` — перевірити бронь

Телефон обов'язковий: це підтвердження, що бронь належить тому, хто питає.
Код і телефон не збігаються → **404**.

## 5. `POST /bookings/{code}/cancel` — скасувати

**Тіло:** `{"phone": "+380671234567", "reason": "змінились плани"}`

Телефон не збігається → **404**.

---

## Об'єкт броні (відповідь §3–5)

```json
{
  "confirmation_code": "RP-1A2B3C4D",
  "status": "pending",
  "check_in": "2026-09-12",
  "check_out": "2026-09-15",
  "nights": 3,
  "adults": 2,
  "children": 1,
  "room_type_id": "family",
  "room_type_name": "Family Suite",
  "rate_plan_name": "Сніданок включено",
  "meal_plan": "Сніданок (шведський стіл)",
  "total_price": 18300,
  "currency": "UAH",
  "guest": { "full_name": "Олена Ковальчук", "phone": "+380671234567", "email": "olena@example.com" },
  "comment": "Потрібне дитяче ліжечко",
  "cancellation_policy": "Безкоштовне скасування за 7 днів до заїзду.",
  "payment_url": "https://rutapolyana.com/booking/confirm/RP-1A2B3C4D",
  "created_at": "2026-08-27T10:15:00Z",
  "hold_expires_at": "2026-08-28T10:15:00Z"
}
```

`status`: `pending` | `confirmed` | `cancelled` | `expired`

---

## Помилки

| Код | Коли |
|---|---|
| `404` | Бронь не знайдено або телефон не збігається |
| `409` | Номер уже зайняли, поки гість думав |
| `422` | Некоректні дані запиту |
| `5xx` | Помилка CRM |

Тіло помилки: `{"message": "текст, який можна показати гостю"}`.
