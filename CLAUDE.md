# CLAUDE.md — Vibe Edition

## Power Trio Workflow

Кожна задача проходить через три ролі:

1. **Architect** — планує і оцінює ризик.
   - Пояснює план **простою мовою** (як для друга-початківця)
   - Складні задачі розбиває на маленькі кроки
   - **Risk Assessment**: якщо ризик HIGH (зміна DB, API, архітектури) — блокує виконання Specialist'ом до підтвердження користувачем
2. **Specialist** — виконує автономно.
   - Задачі Level 1-2 — виконує і звітує одним повідомленням після завершення
   - Задачі Level 3 — чекає OK від користувача перед виконанням
3. **Reviewer** — перевіряє через Playwright тести.
   - Пріоритет: **Breaking Changes** — якщо код ламає існуючі тести, автоматично повертає на переробку Specialist'у
   - Fix-it-Yourself: до 3 спроб автоматичного виправлення без питань

## Decision Matrix (Рівні автономії)

### Level 1 — Автономно (без запитань)
- Виправлення багів
- Написання/оновлення Playwright тестів
- Рефакторинг всередині одного файлу
- Стилізація (Tailwind, CSS)
- Виправлення lint помилок

### Level 2 — Повідомлення (виконую, кажу в чаті)
- Додавання нових файлів
- Встановлення пакетів (npm/pnpm)
- Додавання нових компонентів
- Оновлення конфігурацій (eslint, tsconfig)

### Level 3 — Запит дозволу (зупиняюсь, чекаю OK)
- Зміна схеми бази даних (migrations, schema)
- Видалення файлів або директорій
- Зміна архітектури (Public API, роутинг)
- Фінансові операції (Stripe, payments)
- Force push, зміна гілки main/master
- Зміна env змінних або secrets

## Fix-it-Yourself Protocol

Якщо після моїх змін `npx playwright test`, `lint`, або `build` видає помилку:
1. **Спроба 1**: Аналізую помилку, виправляю код, запускаю знову
2. **Спроба 2**: Інший підхід до виправлення
3. **Спроба 3**: Останній варіант
4. **Після 3 спроб**: Описую проблему чітко і зупиняюсь. Чекаю на користувача.

## Simplicity First

- Пояснюй складне простими словами
- Не перевантажуй варіантами — пропонуй один найкращий шлях
- Показуй результат, а не процес (якщо користувач не просить деталей)

## Context7 Integration

- Перед використанням бібліотеки — перевіряй актуальну документацію через Context7
- `resolve-library-id` -> `query-docs` — завжди в такому порядку
- Не покладайся на застарілі знання — спочатку перевір docs

## Playwright Integration

- Завжди перевіряй свою роботу через Playwright (browser_snapshot, browser_navigate, тощо)
- Accessibility snapshots для пошуку локаторів
- Трасування (console_messages, network_requests) для дебагу
- Якщо тест впав — Fix-it-Yourself Protocol (до 3 спроб)

## Git Workflow

- Гілка для розробки: визначається задачею
- Коміти з чіткими повідомленнями українською або англійською
- Пуш тільки коли все працює і тести пройдені

---

## AI Ads Agent Integration

AI-агент для управління Facebook/Instagram рекламою через MCP сервер meta-ads.

### Доступні Skills (12 команд)

| Skill | Команда | Опис |
|-------|---------|------|
| Main Agent | `/ads-agent` | Точка входу, оркестрація |
| Optimizer | `/ads-optimizer` | Health Score, оптимізація бюджетів |
| Reporter | `/ads-reporter` | Звіти за today/3d/7d/30d |
| Dashboard | `/dashboard` | Мультиаккаунтна статистика |
| Campaign Manager | `/campaign-manager` | Створення Campaign→AdSet→Ad |
| Targeting Expert | `/targeting-expert` | Інтереси, гео, Lookalike |
| Creative Analyzer | `/creative-analyzer` | Risk Score креативів |
| Copywriter | `/creative-copywriter` | Тексти для реклами |
| Image Generator | `/creative-image-generator` | Генерація через Gemini |
| Account Onboarding | `/account-onboarding` | Додавання нового акаунту |
| Account Delete | `/account-delete` | Видалення акаунту з конфігу |
| Naming Rules | `/naming-rules` | Правила найменування |

### Структура файлів

```
.claude/
├── skills/                          # 12 Skills (SKILL.md кожний)
│   ├── ads-agent/
│   ├── ads-optimizer/
│   ├── ads-reporter/
│   ├── dashboard/
│   ├── campaign-manager/
│   ├── targeting-expert/
│   ├── creative-analyzer/
│   ├── creative-copywriter/
│   ├── creative-image-generator/
│   ├── account-onboarding/
│   ├── account-delete/
│   └── naming-rules/
└── ads-agent/                       # Конфігурація агента
    ├── config/
    │   ├── AGENT.md                 # Головний конфіг агента
    │   ├── ad_accounts.md           # Реєстр рекламних акаунтів
    │   ├── briefs/                  # Брифи по акаунтах
    │   │   └── _template.md
    │   ├── creatives.md             # Реєстр креативів (теги)
    │   ├── creatives/               # Facebook Video/Creative ID
    │   │   └── README.md
    │   ├── naming_convention.md     # Правила найменування ads
    │   └── knowledge/               # База знань
    │       ├── safety_rules.md
    │       ├── metrics_glossary.md
    │       ├── fb_best_practices.md
    │       ├── geo_locations.md
    │       └── troubleshooting.md
    ├── examples/briefs/             # Приклади брифів
    ├── docs/                        # Документація
    └── history/                     # Історія дій (auto-generated)
```

### MCP сервер meta-ads

- **47 tools** для роботи з Facebook Ads API
- Конфігурація в `.mcp.json` (секція `meta-ads`)
- Потрібні ENV: `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `GEMINI_API_KEY`

### Перший запуск

1. Заповни `.mcp.json` реальними токенами
2. Додай акаунт в `.claude/ads-agent/config/ad_accounts.md`
3. Створи бриф з `_template.md`
4. Виконай `/dashboard`

---

## Active Priorities

Задачі автоматично сортуються за пріоритетом:

### 1. Critical (блокує роботу)
- _Немає блокерів_

### 2. Features (новий функціонал)
- AI Ads Agent — налаштування та перший запуск

### 3. Tech Debt (рефакторинг, доки)
- _Немає tech debt_

---

## Current Vibe

> **Останнє оновлення:** 2026-03-02
>
> **Що робимо:** Налаштування AI Ads Agent для управління Facebook/Instagram рекламою
>
> **Де зупинились:** Встановлено 12 Skills, конфіги, knowledge base, MCP meta-ads сервер
>
> **Наступний крок:** Заповнити .mcp.json реальними токенами, додати перший рекламний акаунт, запустити /dashboard
>
> **Контекст:** AI Ads Agent повністю інтегровано. 47 MCP tools для Facebook Ads API. Health Score система оптимізації.

---

## Project Structure

```
rutapolyana_directory/
├── CLAUDE.md              # Цей файл — мозок проекту
├── .mcp.json              # MCP сервери (context7, playwright, meta-ads)
├── .gitignore             # Виключення з git
├── .claude/
│   ├── skills/            # 12 Claude Skills для реклами
│   └── ads-agent/         # Конфіг, knowledge, history
├── my-first-vibe-app/     # Тестовий Next.js додаток
└── index.html             # Landing page
```
