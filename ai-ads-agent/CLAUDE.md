# AI Ads Agent

AI-агент для управления Facebook/Instagram рекламой через Claude Code + MCP сервер meta-ads.

---

## Быстрый старт

1. Заполни `.mcp.json` реальными токенами (META_APP_ID, META_APP_SECRET, META_ACCESS_TOKEN, GEMINI_API_KEY)
2. Добавь аккаунт в `config/ad_accounts.md`
3. Создай бриф из `config/briefs/_template.md`
4. Запусти `/dashboard`

---

## Доступные Skills (12 команд)

| Skill | Команда | Описание |
|-------|---------|----------|
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

---

## Структура проекту

```
ai-ads-agent/
├── CLAUDE.md                    # Цей файл
├── .mcp.json                    # MCP meta-ads сервер (47 tools)
├── .gitignore                   # Виключення з git
├── .claude/
│   └── skills/                  # 12 Skills (SKILL.md)
│       ├── ads-agent/
│       ├── ads-optimizer/
│       ├── ads-reporter/
│       ├── dashboard/
│       ├── campaign-manager/
│       ├── targeting-expert/
│       ├── creative-analyzer/
│       ├── creative-copywriter/
│       ├── creative-image-generator/
│       ├── account-onboarding/
│       ├── account-delete/
│       └── naming-rules/
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
│   ├── 00-full-setup-guide.md
│   ├── 01-installation.md
│   ├── 02-mcp-setup.md
│   └── 03-first-account.md
└── history/                     # Історія дій (auto-generated)
```

---

## MCP сервер meta-ads

- **47 tools** для роботи з Facebook Ads API
- Конфігурація в `.mcp.json`
- Потрібні ENV: `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `GEMINI_API_KEY`
- Документація: https://github.com/dengineproblem/meta-ads-mcp-extended

---

## Health Score система

Оцінка ефективності AdSets від -100 до +100:

| Клас | Діапазон | Дія |
|------|----------|-----|
| very_good | >= +25 | Масштабувати +20..+30% |
| good | +5..+24 | Тримати або +10% |
| neutral | -5..+4 | Моніторинг |
| slightly_bad | -25..-6 | Знижувати -20..-50% |
| bad | <= -25 | Пауза або -50% |

---

## Dangerous операції (потрібне підтвердження)

- Зміна бюджетів
- Пауза/відновлення кампаній, adsets, ads
- Створення нових кампаній
- Будь-що що впливає на витрати

---

## Документація

- [Повна інструкція з нуля (14 кроків)](docs/00-full-setup-guide.md)
- [Встановлення Claude Code](docs/01-installation.md)
- [Налаштування MCP](docs/02-mcp-setup.md)
- [Додавання першого акаунту](docs/03-first-account.md)
