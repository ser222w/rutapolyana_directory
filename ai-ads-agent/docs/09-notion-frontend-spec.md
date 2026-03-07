# ТЗ: Notion як фронтенд для AI Ads Agent

> Notion замість VS Code — команда працює через знайомий інтерфейс з табличками, дошками і автоматизацією.
> Бот (OpenClaw / claude-code-telegram) + Notion + n8n = повна система без терміналу.

---

## Чому Notion?

| Проблема з VS Code | Рішення через Notion |
|---------------------|---------------------|
| Термінал — незрозумілий для CEO | Таблиці, дошки, галереї — все знайоме |
| Треба встановлювати на кожен ПК | Працює в браузері + мобільний додаток |
| Немає графіків і візуалізації | Є charts, progress bars, rollups |
| Немає спільної роботи | Real-time collaboration, коментарі, mentions |
| $25-100/міс за кожного юзера | Notion Free для маленьких команд / $8-10/юзер Pro |

---

## Загальна архітектура

```
┌─────────────────────────────────────────────────────────┐
│                    NOTION (фронтенд)                     │
│                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│  │ 📊 Dashboard  │ │ ⚙️ Settings  │ │ 📝 Reports       │ │
│  │ Campaigns DB  │ │ Accounts DB  │ │ Daily Reports DB │ │
│  │ Table + Board │ │ Table view   │ │ Calendar + Table │ │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────────┘ │
│         │                │                │              │
└─────────┼────────────────┼────────────────┼──────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────┐
│              Notion API / Notion MCP Server               │
│         (notion-sdk-py або @notionhq/client)              │
└─────────────────────┬───────────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
┌──────────────┐ ┌─────────┐ ┌────────────────┐
│ OpenClaw /    │ │  n8n    │ │ Meta Ads API   │
│ TG Bot        │ │ (cron)  │ │ (через MCP)    │
│ Читає settings│ │ Пушить  │ │ 47 інструментів│
│ Пише алерти   │ │ звіти   │ │                │
└──────────────┘ └─────────┘ └────────────────┘
```

**Потік даних:**
1. Команда редагує settings/budgets в Notion
2. Бот (або n8n) читає зміни через Notion API
3. Бот виконує дії в Meta Ads через MCP
4. Результати записуються назад в Notion databases
5. Алерти летять в Telegram

---

## Notion Databases (5 штук)

### DB 1: 📊 Ad Campaigns (головна таблиця)

Відображає всі кампанії з усіх акаунтів.

| Поле | Тип | Опис |
|------|-----|------|
| Campaign Name | Title | Назва кампанії |
| Account | Select | Рекламний акаунт |
| Platform | Select | Meta / Google |
| Status | Select | Active / Paused / Draft / Completed |
| Daily Budget | Number ($) | Денний бюджет |
| Spend (today) | Number ($) | Витрати за сьогодні |
| Spend (total) | Number ($) | Загальні витрати |
| Impressions | Number | Покази |
| Clicks | Number | Кліки |
| CTR | Formula | `Clicks / Impressions * 100` |
| CPC | Formula | `Spend / Clicks` |
| Leads | Number | Кількість лідів |
| CPL | Formula | `Spend / Leads` |
| ROAS | Formula | `Revenue / Spend` |
| Health Score | Number | -100 до +100 (з ads-optimizer) |
| Health Class | Formula | very_good / good / neutral / bad |
| Last Updated | Date | Час останнього оновлення |

**Views:**
- **Table** — повна таблиця з сортуванням по Health Score
- **Board** — Kanban по статусу (Active / Paused / Draft)
- **Calendar** — по даті запуску
- **Gallery** — з превʼю креативів

---

### DB 2: ⚙️ Account Settings (конфігурація)

Команда редагує тут — бот читає.

| Поле | Тип | Опис |
|------|-----|------|
| Account Name | Title | Назва акаунту |
| Account ID | Text | Facebook Account ID |
| Max Daily Budget | Number ($) | Максимальний денний бюджет |
| Target CPL | Number ($) | Цільова вартість ліда |
| Target ROAS | Number | Цільовий ROAS |
| Auto-Optimize | Checkbox | Дозволити боту автооптимізацію |
| Alert Threshold | Number (%) | При якому відхиленні слати алерт |
| Active | Checkbox | Чи активний акаунт |
| Manager | Person | Відповідальний менеджер |
| Notes | Rich Text | Нотатки по акаунту |

**Як це працює:**
- CEO ставить галочку "Auto-Optimize" → бот починає автоматично оптимізувати бюджети
- Маркетолог змінює "Target CPL" → бот коригує стратегію
- Аналітик додає "Notes" → бот враховує при генерації звітів

---

### DB 3: 📝 Daily Reports (звіти)

Бот записує — команда читає.

| Поле | Тип | Опис |
|------|-----|------|
| Report Date | Title (Date) | Дата звіту |
| Account | Relation → DB2 | Зв'язок з акаунтом |
| Total Spend | Number ($) | Загальні витрати за день |
| Total Leads | Number | Лідів за день |
| Avg CPL | Number ($) | Середній CPL |
| Avg CTR | Number (%) | Середній CTR |
| Health Summary | Rich Text | Текстовий саммарі від AI |
| Recommendations | Rich Text | Рекомендації від ads-optimizer |
| Top Campaign | Text | Найкраща кампанія дня |
| Worst Campaign | Text | Найгірша кампанія дня |
| Alerts | Multi-select | Типи алертів (overspend, low_ctr, etc) |

**Views:**
- **Calendar** — по датах, для огляду трендів
- **Table** — відсортовано по даті (newest first)
- **Filtered: This Week** — тільки поточний тиждень

---

### DB 4: 🎨 Creatives Library (креативи)

| Поле | Тип | Опис |
|------|-----|------|
| Creative Name | Title | Назва креативу |
| Type | Select | Image / Video / Carousel |
| Preview | Files & Media | Превʼю зображення |
| Account | Relation → DB2 | Для якого акаунту |
| Campaign | Relation → DB1 | В якій кампанії |
| Status | Select | Active / Tested / Archived |
| Risk Score | Number | Від creative-analyzer |
| CTR | Number (%) | CTR цього креативу |
| Spend | Number ($) | Витрачено на цей креатив |
| Performance | Select | Winner / Average / Loser |
| Tags | Multi-select | dental, before_after, testimonial |
| AI Notes | Rich Text | Аналіз від creative-analyzer |

**Views:**
- **Gallery** — візуальний перегляд з превʼю
- **Board** — по Performance (Winner / Average / Loser)

---

### DB 5: 🚨 Alerts & Actions (алерти і дії)

| Поле | Тип | Опис |
|------|-----|------|
| Alert | Title | Опис алерту |
| Type | Select | overspend / low_ctr / budget_limit / health_drop |
| Severity | Select | 🔴 Critical / 🟡 Warning / 🟢 Info |
| Account | Relation → DB2 | Акаунт |
| Campaign | Relation → DB1 | Кампанія |
| Auto-Action | Text | Що бот зробив автоматично |
| Manual Action Needed | Checkbox | Чи потрібна дія людини |
| Resolved | Checkbox | Вирішено |
| Created | Created time | Коли створено |

---

## Notion MCP Server (підключення)

Notion має **офіційний MCP сервер** — бот може читати і писати в Notion нативно.

**Додати в `.mcp.json`:**
```json
{
  "mcpServers": {
    "meta-ads": {
      "command": "npx",
      "args": ["-y", "@anthropic/meta-ads-mcp-extended"],
      "env": {
        "META_APP_ID": "ваш_app_id",
        "META_APP_SECRET": "ваш_secret",
        "META_ACCESS_TOKEN": "ваш_token"
      }
    },
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "NOTION_API_KEY": "ntn_ваш_notion_integration_token",
        "NOTION_MARKDOWN_CONVERSION": "true"
      }
    }
  }
}
```

**Або hosted варіант (без npx):**
```json
{
  "mcpServers": {
    "notion": {
      "url": "https://mcp.notion.com/mcp",
      "headers": {
        "Authorization": "Bearer ntn_ваш_токен"
      }
    }
  }
}
```

**GitHub:** [makenotion/notion-mcp-server](https://github.com/makenotion/notion-mcp-server)

---

## Налаштування Notion (покрокова інструкція)

### Крок 1: Створити Notion Integration

```
1. Зайти на https://developers.notion.com
2. "New Integration"
3. Назва: "AI Ads Agent"
4. Capabilities: Read content, Update content, Insert content
5. Зберегти API Key (починається з ntn_...)
```

### Крок 2: Створити робочий простір

```
1. Створити сторінку "AI Ads Agent" в Notion
2. Додати 5 баз даних (DB1-DB5) як inline databases
3. Налаштувати поля згідно таблиць вище
4. "Share" → запросити інтеграцію "AI Ads Agent" → "Invite"
```

### Крок 3: Створити Views

```
Для кожної DB — налаштувати views:
- DB1 (Campaigns): Table + Board (by Status) + Calendar
- DB2 (Settings): Table
- DB3 (Reports): Calendar + Table (sorted by date desc)
- DB4 (Creatives): Gallery + Board (by Performance)
- DB5 (Alerts): Table (filtered: Resolved = false)
```

### Крок 4: Підключити MCP

```
1. Додати notion MCP server в .mcp.json (див. вище)
2. Перезапустити Claude Code / бота
3. Тест: попросити бота "Покажи всі акаунти з Notion"
```

### Крок 5: Налаштувати n8n workflows

```
Потрібні 3 автоматичні workflows:

1. [Щоденно 09:00] Оновлення DB1 (Campaigns)
   Trigger: Cron 09:00
   → Meta Ads API: get campaigns
   → Notion: update DB1 rows

2. [Щоденно 21:00] Генерація Daily Report
   Trigger: Cron 21:00
   → Meta Ads API: get daily stats
   → Claude: generate summary + recommendations
   → Notion: create row in DB3
   → Telegram: send summary

3. [Кожні 2 години] Алерти
   Trigger: Cron every 2h
   → Meta Ads API: check metrics
   → IF anomaly detected → Notion: create alert in DB5
   → Telegram: send alert
```

---

## Готові шаблони Notion (для старту)

Можна використати як основу і адаптувати:

| Шаблон | Посилання | Що дає |
|--------|-----------|--------|
| Complete Ads Dashboard | [Notion Marketplace](https://www.notion.com/templates/marketing-campaigns-dashboard) | Multi-platform кампанії |
| Ads Manager | [Notion Marketplace](https://www.notion.com/templates/ads-manager) | Централізований менеджмент |
| Ad Campaign Tracker | [Notion Marketplace](https://www.notion.com/templates/ad-campaign-tracker) | ROI та ROAS трекінг |
| Facebook Ads Dashboard | [Notion Marketplace](https://www.notion.com/templates/facebook-ads-dashboard) | Спеціально для Meta |
| Facebook Ads Planner | [Landmark Labs](https://www.landmarklabs.co/block/facebook-ads-planner-template) | Воронка Meta планування |

---

## Інтеграція з існуючими Skills

Як кожен skill працюватиме з Notion:

| Skill | Читає з Notion | Пише в Notion |
|-------|---------------|---------------|
| `/dashboard` | — | DB1 (Campaigns) — оновлює метрики |
| `/ads-reporter` | DB2 (Settings) — період, акаунт | DB3 (Reports) — щоденні звіти |
| `/ads-optimizer` | DB2 (Settings) — target CPL, auto-optimize | DB1 (Health Score), DB5 (Alerts) |
| `/campaign-manager` | DB2 (Settings) — бюджети, таргети | DB1 (нова кампанія) |
| `/creative-analyzer` | DB4 (Creatives) — список креативів | DB4 (Risk Score, AI Notes) |
| `/creative-copywriter` | DB2 (Notes) — бриф | DB4 (новий креатив) |
| `/account-onboarding` | — | DB2 (новий акаунт) |
| `/targeting-expert` | DB2 (Settings) — гео, демографія | DB1 (оновлений таргетинг) |

---

## Бібліотеки та інструменти

### Python (для бота або n8n custom nodes)
```bash
pip install notion-client  # notion-sdk-py
```

```python
from notion_client import Client

notion = Client(auth="ntn_ваш_токен")

# Читати кампанії
campaigns = notion.databases.query(database_id="db1_id")

# Записати звіт
notion.pages.create(
    parent={"database_id": "db3_id"},
    properties={
        "Report Date": {"title": [{"text": {"content": "2026-03-07"}}]},
        "Total Spend": {"number": 450.00},
        "Total Leads": {"number": 98},
        "Avg CPL": {"number": 4.59},
        "Health Summary": {"rich_text": [{"text": {"content": "Всі акаунти в нормі..."}}]}
    }
)
```

### Node.js (для OpenClaw skill)
```bash
npm install @notionhq/client
```

```javascript
const { Client } = require("@notionhq/client");
const notion = new Client({ auth: "ntn_ваш_токен" });

// Читати settings
const settings = await notion.databases.query({ database_id: "db2_id" });

// Оновити Health Score кампанії
await notion.pages.update({
  page_id: "page_id",
  properties: {
    "Health Score": { number: 42 },
    "Health Class": { select: { name: "very_good" } }
  }
});
```

### No-code інструменти
| Інструмент | Що робить | Ціна |
|-----------|-----------|------|
| [Note API Connector](https://noteapiconnector.com/) | Meta Ads → Notion автоматично | від $12/міс |
| [n8n](https://n8n.io/) | Будь-які workflows, self-hosted | Безкоштовно |
| [Make](https://www.make.com/) | Візуальні workflows | від $9/міс |
| [Zapier](https://zapier.com/) | Прості тригери | від $20/міс |

---

## Порядок впровадження

### Фаза 1: Базовий Notion (1-2 дні)
```
□ Створити Notion Integration (API key)
□ Створити робочий простір з 5 databases
□ Підключити Notion MCP server до .mcp.json
□ Тест: бот читає/пише в Notion
```

### Фаза 2: Автоматичні звіти (2-3 дні)
```
□ Налаштувати n8n workflow: daily campaign sync → DB1
□ Налаштувати n8n workflow: daily report → DB3
□ Налаштувати alerts workflow → DB5 + Telegram
□ Тест: кожен ранок DB1 оновлюється автоматично
```

### Фаза 3: Двостороння інтеграція (3-5 днів)
```
□ Бот читає settings з DB2 для оптимізації
□ Зміна бюджету в Notion → бот оновлює Meta Ads
□ Новий креатив в DB4 → бот аналізує (creative-analyzer)
□ Тест: CEO змінює Target CPL → бот реагує
```

### Фаза 4: Повна автоматизація (1 тиждень)
```
□ Всі 12 skills інтегровані з Notion
□ Команда працює тільки через Notion + Telegram
□ VS Code більше не потрібен для щоденної роботи
□ Документація для команди
```

---

## Джерела

- [Notion MCP Server (офіційний)](https://github.com/makenotion/notion-mcp-server)
- [Notion API Documentation](https://developers.notion.com)
- [Notion MCP Docs](https://developers.notion.com/docs/mcp)
- [notion-sdk-py (Python)](https://github.com/ramnes/notion-sdk-py)
- [notion-sdk-js (Node.js)](https://github.com/makenotion/notion-sdk-js)
- [Note API Connector — Meta Ads → Notion](https://noteapiconnector.com/import-facebook-ads-data-to-notion)
- [n8n: Meta Ads Automation](https://madgicx.com/blog/meta-ads-n8n)
- [n8n: Daily Google Ads → Notion template](https://n8n.io/workflows/7133-daily-google-ads-performance-to-notion-and-google-sheets/)
- [n8n: AI Marketing Report → Telegram](https://n8n.io/workflows/2783-ai-marketing-report-google-analytics-and-ads-meta-ads-sent-via-emailtelegram/)
- [Notion Database Automations](https://www.notion.com/help/database-automations)
- [Notion Marketing Templates (28 шт)](https://www.notionapps.com/blog/best-notion-templates-marketing-2025)
