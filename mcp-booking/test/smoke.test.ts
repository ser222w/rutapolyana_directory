import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Server } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { app } from '../src/index.js';

/**
 * E2E-перевірка справжнім MCP-клієнтом: піднімаємо HTTP-сервер,
 * підключаємось так само, як це зробить Claude чи ChatGPT, і проходимо шлях гостя.
 */

let server: Server;
let baseUrl: string;
let client: Client;

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

const CHECK_IN = futureDate(30);
const CHECK_OUT = futureDate(33);

function textOf(result: unknown): string {
  const content = (result as { content: { type: string; text?: string }[] }).content;
  return content.map((c) => c.text ?? '').join('\n');
}

describe('MCP-сервер бронювання', () => {
  before(async () => {
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const { port } = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${port}`;

    client = new Client({ name: 'test-guest', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`)));
  });

  after(async () => {
    await client.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('віддає health', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).status, 'ok');
  });

  it('публікує повний набір інструментів', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      'cancel_booking',
      'create_booking',
      'get_booking',
      'get_hotel_info',
      'list_room_types',
      'search_availability',
    ]);
  });

  it('віддає ресурс і промпт', async () => {
    const { resources } = await client.listResources();
    assert.ok(resources.some((r) => r.uri === 'hotel://rutapolyana/overview'));
    const { prompts } = await client.listPrompts();
    assert.ok(prompts.some((p) => p.name === 'plan_stay'));
  });

  it('знаходить вільні номери з цінами', async () => {
    const result = await client.callTool({
      name: 'search_availability',
      arguments: { check_in: CHECK_IN, check_out: CHECK_OUT, adults: 2 },
    });
    const text = textOf(result);
    assert.match(text, /room_type_id=/);
    assert.match(text, /UAH/);
  });

  it('відхиляє дати в минулому зрозумілим повідомленням', async () => {
    const result = await client.callTool({
      name: 'search_availability',
      arguments: { check_in: '2020-01-01', check_out: '2020-01-03', adults: 2 },
    });
    assert.equal(result.isError, true);
    assert.match(textOf(result), /минул/i);
  });

  it('відхиляє виїзд раніше за заїзд', async () => {
    const result = await client.callTool({
      name: 'search_availability',
      arguments: { check_in: CHECK_OUT, check_out: CHECK_IN, adults: 2 },
    });
    assert.equal(result.isError, true);
  });

  it('проходить повний цикл: бронювання → перевірка → скасування', async () => {
    const offers = textOf(
      await client.callTool({
        name: 'search_availability',
        arguments: { check_in: CHECK_IN, check_out: CHECK_OUT, adults: 2 },
      })
    );
    const match = offers.match(/room_type_id="([^"]+)", rate_plan_id="([^"]+)"/);
    assert.ok(match, 'у відповіді має бути id номера й тарифу');
    const [, roomTypeId, ratePlanId] = match;

    const created = textOf(
      await client.callTool({
        name: 'create_booking',
        arguments: {
          check_in: CHECK_IN,
          check_out: CHECK_OUT,
          adults: 2,
          room_type_id: roomTypeId,
          rate_plan_id: ratePlanId,
          guest_full_name: 'Тестовий Гість',
          guest_phone: '0671234567',
          guest_email: 'guest@example.com',
        },
      })
    );
    const code = created.match(/Код бронювання: (RP-[A-Z0-9]+)/)?.[1];
    assert.ok(code, 'бронювання має повернути код');
    assert.match(created, /pending|очікує/i);

    const found = textOf(
      await client.callTool({
        name: 'get_booking',
        arguments: { confirmation_code: code, phone: '+380671234567' },
      })
    );
    assert.match(found, new RegExp(code));

    const wrongPhone = textOf(
      await client.callTool({
        name: 'get_booking',
        arguments: { confirmation_code: code, phone: '+380509999999' },
      })
    );
    assert.match(wrongPhone, /не знайдено/i);

    const cancelled = textOf(
      await client.callTool({
        name: 'cancel_booking',
        arguments: { confirmation_code: code, phone: '0671234567', reason: 'тест' },
      })
    );
    assert.match(cancelled, /Скасовано/i);
  });

  it('віддає довідку про готель', async () => {
    const all = textOf(await client.callTool({ name: 'get_hotel_info', arguments: {} }));
    assert.match(all, /Аква-зона/);
    const wellness = textOf(
      await client.callTool({ name: 'get_hotel_info', arguments: { topic: 'wellness' } })
    );
    assert.match(wellness, /чани/i);
    assert.doesNotMatch(wellness, /Синевир/);
  });
});
