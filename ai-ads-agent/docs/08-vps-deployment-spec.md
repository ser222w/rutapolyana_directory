# ТЗ: Розгортання AI Ads Agent на VPS

> Telegram бот + Claude Code + Notion звіти + автоматизація n8n
> Для команди з 4 людей: CEO, маркетолог, контент-менеджер, аналітик

---

## Вибір бота: OpenClaw vs claude-code-telegram

| Критерій | OpenClaw | claude-code-telegram |
|----------|----------|---------------------|
| GitHub зірки | 273,000+ | ~1,500 |
| Мови | TypeScript | Python |
| Telegram | Нативна підтримка (grammY) | python-telegram-bot |
| Claude API | Нативно (claude-provider.js) | Claude SDK |
| MCP | Через MCP Hub skill (1,200+ серверів) | Нативно (ENABLE_MCP=true) |
| Інші канали | WhatsApp, Discord, Slack, Signal, iMessage, Teams | Тільки Telegram |
| Skills екосистема | 13,700+ на ClawHub | Немає маркетплейсу |
| Складність | Легко (1-click deploy) | Середньо (Python setup) |
| Документація | Відмінна (docs.openclaw.ai) | Добра (README + DO tutorial) |

**Рекомендація:** Почати з **OpenClaw** (простіший старт, більше каналів, величезна спільнота). Якщо потрібна глибша інтеграція з Claude Code SDK — використати **claude-code-telegram**.

Нижче — інструкції для ОБОХ варіантів.

---

## Загальна архітектура

```
┌────────────────── VPS (Ubuntu 22.04, 4GB RAM) ──────────────────┐
│                                                                  │
│  ┌──────────────────────┐    ┌───────────────────────────────┐  │
│  │  OpenClaw /           │    │  n8n (Docker)                │  │
│  │  claude-code-telegram │    │  Автоматизація:              │  │
│  │                       │    │  • Ранкові звіти → TG        │  │
│  │  Порт: —              │    │  • Алерти → TG               │  │
│  │  Процес: systemd      │    │  • Звіти → Notion            │  │
│  │                       │    │  • Розклад оптимізацій       │  │
│  └──────────┬────────────┘    └──────────┬────────────────────┘  │
│             │                            │                       │
│             ▼                            ▼                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Claude Code (SDK)                       │   │
│  │                   + MCP Server (meta-ads)                 │   │
│  │                   + ai-ads-agent/ (скіли, конфіги)        │   │
│  └──────────────────────────────────────────────────────────┘   │
│             │                            │                       │
│             ▼                            ▼                       │
│  ┌─────────────────────┐    ┌────────────────────────────────┐  │
│  │  Meta Ads API        │    │  Notion API                   │  │
│  │  (47 MCP інструментів)│    │  (звіти, логи, дашборд)      │  │
│  └─────────────────────┘    └────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Telegram Mini App (опціонально, фаза 2)                 │   │
│  │  Хост: Vercel (безкоштовно)                              │   │
│  │  React + Chart.js + TanStack Table                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Зовнішні сервіси:**
```
Telegram ←→ VPS (бот)
Notion   ←→ VPS (API звіти)
Meta Ads ←→ VPS (MCP)
Claude API ←→ VPS (Anthropic)
Vercel   ←→ Telegram Mini App (опціонально)
```

---

## Фаза 1: Базовий бот (3-5 днів)

### 1.1 VPS — оренда і підготовка

**Вимоги до сервера:**

| Параметр | Мінімум | Рекомендовано |
|----------|---------|---------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Диск | 40 GB SSD | 80 GB SSD |
| ОС | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Локація | Європа (Амстердам/Франкфурт) | Ближче до вашого регіону |

**Де орендувати:**

| Провайдер | Ціна/міс | Коментар |
|-----------|----------|----------|
| Hetzner | €4-8 | Найдешевший, EU серверы |
| DigitalOcean | $12-24 | Є туторіал для claude-code-telegram |
| Vultr | $12-24 | Швидкий, багато локацій |
| Contabo | €5-10 | Дешевий, але повільніша підтримка |

**Задачі:**
```
□ Орендувати VPS (Ubuntu 22.04, 4GB+ RAM)
□ Налаштувати SSH ключ (не пароль!)
□ Створити юзера (не root): sudo adduser adsbot
□ Налаштувати файрвол (ufw):
    - SSH (22)
    - HTTPS (443) — для n8n і Mini App
    - Закрити все інше
□ Встановити базові пакети: git, curl, build-essential
□ Встановити Docker + Docker Compose (для n8n)
□ Встановити Node.js 20+ (для Claude Code)
□ Встановити Python 3.11+ (для бота)
```

**Команди:**
```bash
# Оновлення системи
sudo apt update && sudo apt upgrade -y

# Базові пакети
sudo apt install -y git curl wget build-essential ufw nginx certbot python3-certbot-nginx

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Python 3.11
sudo apt install -y python3.11 python3.11-venv python3-pip

# Docker
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker adsbot

# Файрвол
sudo ufw allow OpenSSH
sudo ufw allow 443/tcp
sudo ufw enable

# Claude Code
npm install -g @anthropic-ai/claude-code
```

---

### 1.2 Telegram бот — створення

**Спочатку для обох варіантів:**
```
□ Створити Telegram бота через @BotFather:
    1. Відкрити @BotFather в Telegram
    2. /newbot
    3. Назва: "AI Ads Agent" (або ваша)
    4. Username: ai_ads_agent_bot (має закінчуватись на "bot")
    5. Зберегти TOKEN

□ Отримати Telegram User ID кожного з 4 людей:
    1. Кожен пише @userinfobot
    2. Записати ID (наприклад: 123456789)
```

---

#### Варіант А: OpenClaw (рекомендовано)

**Інструмент: [OpenClaw](https://github.com/openclaw/openclaw)** — 273K+ зірок, найпопулярніший open-source AI асистент.

**Що це:** Self-hosted AI assistant який працює через Telegram, WhatsApp, Discord, Slack, Signal, iMessage та інші канали. Під капотом використовує Claude API.

**Переваги:**
- 1-click deploy на VPS ($5/міс достатньо)
- Нативна підтримка Claude (claude-provider.js)
- 13,700+ готових skills на ClawHub
- MCP підтримка через MCP Hub skill
- Документація: docs.openclaw.ai

**Встановлення на VPS:**
```bash
# Клонувати
git clone https://github.com/openclaw/openclaw.git
cd openclaw

# Скопіювати конфіг
cp .env.example .env
```

**Конфігурація `.env`:**
```env
# === AI Provider ===
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-api03-...ваш_ключ
AI_MODEL=claude-opus-4-6

# === Telegram ===
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=7234567890:AAH...ваш_токен
TELEGRAM_ALLOWED_USERS=111111111,222222222,333333333,444444444

# === MCP (для Meta Ads інструментів) ===
MCP_ENABLED=true
MCP_CONFIG_PATH=/home/adsbot/ai-ads-agent/.mcp.json
```

**Запуск через Docker (рекомендовано):**
```bash
# Docker Compose (автозапуск, оновлення)
docker compose up -d

# Перевірити логи
docker compose logs -f
```

**Або через systemd:**
```bash
# Встановити залежності
npm install

# Створити сервіс
sudo tee /etc/systemd/system/openclaw.service << 'EOF'
[Unit]
Description=OpenClaw AI Assistant
After=network.target

[Service]
Type=simple
User=adsbot
WorkingDirectory=/home/adsbot/openclaw
EnvironmentFile=/home/adsbot/openclaw/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable openclaw
sudo systemctl start openclaw
```

**Підключення MCP (Meta Ads tools):**

OpenClaw підтримує MCP через MCP Hub skill. Для підключення ваших 47 інструментів meta-ads:

```bash
# В директорії openclaw, створити mcp-config.json
cat > mcp-config.json << 'MCPEOF'
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
    }
  }
}
MCPEOF
```

**Задачі:**
```
□ Клонувати OpenClaw на VPS
□ Налаштувати .env (Claude API + Telegram)
□ Підключити MCP з meta-ads інструментами
□ Запустити через Docker або systemd
□ Тест: написати боту "Привіт" → має відповісти
□ Тест: написати "Покажи дашборд" → має використати MCP
```

**Корисні посилання:**
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [Документація](https://docs.openclaw.ai)
- [Telegram Integration](https://docs.openclaw.ai/channels/telegram)
- [VPS Hosting Guide](https://docs.openclaw.ai/vps)
- [MCP Integration](https://gist.github.com/Rapha-btc/527d08acc523d6dcdb2c224fe54f3f39)
- [Deploy on $5 VPS](https://medium.com/@rentierdigital/i-deployed-my-own-openclaw-ai-agent-in-4-minutes-it-now-runs-my-life-from-a-5-server-8159e6cb41cc)

---

#### Варіант Б: claude-code-telegram (альтернатива)

**Інструмент: [claude-code-telegram](https://github.com/RichardAtCT/claude-code-telegram)** — production-ready Telegram бот з повною інтеграцією Claude Code SDK.

**Коли обрати:** Якщо потрібна глибша інтеграція з Claude Code (сесії, термінальний режим, GitHub webhooks).

**Переваги:**
- Agentic mode (розмовний) + terminal mode
- Нативна MCP підтримка (ENABLE_MCP=true)
- Webhooks для GitHub подій
- Cron-розклад для автоматичних задач
- Inline keyboards

**Встановлення на VPS:**
```bash
# Як Python пакет (production)
pip install git+https://github.com/RichardAtCT/claude-code-telegram@v1.3.0

# Або з репо (для кастомізації)
git clone https://github.com/RichardAtCT/claude-code-telegram.git
cd claude-code-telegram
make dev
```

**Конфігурація `.env`:**
```env
# === Telegram ===
TELEGRAM_BOT_TOKEN=7234567890:AAH...ваш_токен
TELEGRAM_BOT_USERNAME=ai_ads_agent_bot

# === Доступ (4 людини) ===
ALLOWED_USERS=111111111,222222222,333333333,444444444

# === Claude ===
ANTHROPIC_API_KEY=sk-ant-api03-...ваш_ключ
USE_SDK=true

# === MCP ===
ENABLE_MCP=true
MCP_CONFIG_PATH=/home/adsbot/ai-ads-agent/.mcp.json

# === Робоча директорія ===
APPROVED_DIRECTORY=/home/adsbot/ai-ads-agent
```

**Запуск як systemd сервіс:**
```ini
# /etc/systemd/system/ads-bot.service
[Unit]
Description=AI Ads Agent Telegram Bot
After=network.target

[Service]
Type=simple
User=adsbot
WorkingDirectory=/home/adsbot/ai-ads-agent
EnvironmentFile=/home/adsbot/.env
ExecStart=/usr/local/bin/claude-telegram
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable ads-bot
sudo systemctl start ads-bot
sudo systemctl status ads-bot
```

**Корисні посилання:**
- [GitHub](https://github.com/RichardAtCT/claude-code-telegram)
- [DigitalOcean Tutorial](https://www.digitalocean.com/community/tutorials/edit-code-from-telegram)

---

### 1.3 AI Ads Agent — конфігурація

**Задачі:**
```
□ Клонувати ваш репозиторій на VPS:
    git clone <your-repo-url> /home/adsbot/rutapolyana_directory
    cd /home/adsbot/rutapolyana_directory/ai-ads-agent

□ Налаштувати MCP конфіг (.mcp.json):
    - META_ACCESS_TOKEN: ваш токен Meta
    - META_APP_ID: ваш App ID
    - META_APP_SECRET: ваш App Secret
    - GEMINI_API_KEY: для генерації картинок

□ Заповнити бриф першого акаунту:
    - config/ad_accounts.md
    - config/briefs/{account}.md
    - config/creatives.md

□ Перевірити що все працює:
    - Написати боту "Привіт"
    - Написати боту "/dashboard"
    - Написати боту "Покажи звіт по {акаунт} за вчора"
```

---

### 1.4 Красиві таблиці в Telegram

**Задачі для розробника:**

```
□ Додати форматування повідомлень (HTML mode):
    - Моноширинні таблиці в <pre> блоках
    - Емодзі для статусів (✅ ⚠️ 🔴 ⛔)
    - Health Score з кольоровими індикаторами

□ Додати генерацію картинок-таблиць:
    - Встановити: pip install matplotlib playwright
    - playwright install chromium
    - Для /dashboard → генерувати PNG таблицю
    - Для /ads-reporter → генерувати PNG з графіком тренду
    - Надсилати як фото в Telegram

□ Додати inline keyboards:
    - Вибір акаунту: [Bas Dent] [Smile Clinic] [AutoParts]
    - Вибір періоду: [Сьогодні] [Вчора] [7 днів] [30 днів]
    - Підтвердження дій: [✅ Так, виконати] [❌ Скасувати]
```

---

## Фаза 2: Notion інтеграція (2-3 дні)

### 2.1 Notion — підготовка

**Що буде в Notion:**

```
Notion Workspace
├── 📊 Ads Dashboard (база даних)
│   ├── Щоденні звіти (автоматично)
│   ├── Тижневі звіти (автоматично)
│   └── Місячні звіти (автоматично)
│
├── 📋 Рекламні акаунти (база даних)
│   ├── Bas Dent — бриф, метрики, історія
│   ├── Smile Clinic — бриф, метрики, історія
│   └── AutoParts — бриф, метрики, історія
│
├── 🎨 Креативи (база даних)
│   ├── Всі креативи з Risk Score
│   ├── Статуси: active / paused / archived
│   └── Посилання на файли
│
├── 📝 Історія змін (база даних)
│   ├── Що змінили, коли, хто попросив
│   └── Результат зміни (покращилось/погіршилось)
│
└── 🎯 Задачі маркетолога (база даних)
    ├── Замінити креатив X
    ├── Створити нову кампанію Y
    └── Провести A/B тест Z
```

**Задачі:**
```
□ Створити Notion Integration:
    1. Відкрити notion.so/my-integrations
    2. "+ New Integration"
    3. Назва: "AI Ads Agent"
    4. Capabilities: Read + Insert + Update content
    5. Зберегти Internal Integration Secret (ntn_...)

□ Створити бази даних в Notion:
    1. "Ads Dashboard" — щоденні/тижневі звіти
       Поля: Date, Account, Spend, Leads, CPL, Target CPL,
             Health Score, Status, Notes
    2. "Креативи" — реєстр креативів
       Поля: Name, Tag, Type, Risk Score, CPL, Status, Created
    3. "Історія змін" — аудит лог
       Поля: Date, Account, Action, Before, After, Result

□ Розшарити бази з інтеграцією:
    - Відкрити кожну БД → Share → Invite → "AI Ads Agent"

□ Записати ID баз даних:
    - Відкрити БД → URL: notion.so/{workspace}/{DATABASE_ID}?v=...
    - Зберегти DATABASE_ID для кожної БД
```

### 2.2 Notion — автоматичне наповнення

**Додати в `.env` на VPS:**
```env
# === Notion ===
NOTION_API_KEY=ntn_...ваш_ключ
NOTION_DASHBOARD_DB=abc123...  # ID бази "Ads Dashboard"
NOTION_CREATIVES_DB=def456...  # ID бази "Креативи"
NOTION_HISTORY_DB=ghi789...    # ID бази "Історія змін"
```

**Скрипт `scripts/notion_reporter.py`:**

```python
"""
Скрипт що створює звіти в Notion після кожної оптимізації/звіту.
Викликається з n8n або напряму з бота.
"""
import os
import requests
from datetime import datetime

NOTION_API = "https://api.notion.com/v1"
HEADERS = {
    "Authorization": f"Bearer {os.environ['NOTION_API_KEY']}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
}

def create_daily_report(account: str, data: dict):
    """Створити запис щоденного звіту в Notion."""
    payload = {
        "parent": {"database_id": os.environ["NOTION_DASHBOARD_DB"]},
        "properties": {
            "Date": {"date": {"start": datetime.now().isoformat()[:10]}},
            "Account": {"title": [{"text": {"content": account}}]},
            "Spend": {"number": data["spend"]},
            "Leads": {"number": data["leads"]},
            "CPL": {"number": data["cpl"]},
            "Target CPL": {"number": data["target_cpl"]},
            "Health Score": {"number": data["health_score"]},
            "Status": {"select": {"name": data["status"]}},  # ✅ Good / ⚠️ Warning / 🔴 Bad
        },
        "children": [
            {
                "object": "block",
                "type": "heading_2",
                "heading_2": {
                    "rich_text": [{"text": {"content": f"Звіт {account} — {datetime.now().strftime('%d.%m.%Y')}"}}]
                }
            },
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"text": {"content": data.get("summary", "")}}]
                }
            }
        ]
    }
    response = requests.post(f"{NOTION_API}/pages", headers=HEADERS, json=payload)
    return response.json()

def log_action(account: str, action: str, before: str, after: str, result: str = ""):
    """Записати дію в історію змін."""
    payload = {
        "parent": {"database_id": os.environ["NOTION_HISTORY_DB"]},
        "properties": {
            "Date": {"date": {"start": datetime.now().isoformat()}},
            "Account": {"title": [{"text": {"content": account}}]},
            "Action": {"rich_text": [{"text": {"content": action}}]},
            "Before": {"rich_text": [{"text": {"content": before}}]},
            "After": {"rich_text": [{"text": {"content": after}}]},
            "Result": {"select": {"name": result or "Pending"}},
        }
    }
    response = requests.post(f"{NOTION_API}/pages", headers=HEADERS, json=payload)
    return response.json()
```

**Задачі:**
```
□ Створити scripts/notion_reporter.py (код вище)
□ Додати виклик після /dashboard → create_daily_report()
□ Додати виклик після /ads-optimizer → log_action()
□ Додати виклик після /creative-analyzer → оновити Risk Score в Notion
□ Протестувати: запустити /dashboard → перевірити що з'явився запис в Notion
```

---

## Фаза 3: n8n автоматизація (2-3 дні)

### 3.1 n8n — встановлення

```bash
# Docker Compose для n8n
mkdir -p /home/adsbot/n8n && cd /home/adsbot/n8n

cat > docker-compose.yml << 'EOF'
version: '3'
services:
  n8n:
    image: n8nio/n8n:latest
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=ваш_пароль
      - WEBHOOK_URL=https://n8n.yourdomain.com/
      - GENERIC_TIMEZONE=Asia/Almaty
    volumes:
      - ./data:/home/node/.n8n
EOF

docker compose up -d
```

**Nginx reverse proxy (HTTPS):**
```nginx
# /etc/nginx/sites-available/n8n
server {
    listen 443 ssl;
    server_name n8n.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/n8n.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/n8n.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5678;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/n8n /etc/nginx/sites-enabled/
sudo certbot --nginx -d n8n.yourdomain.com
sudo systemctl reload nginx
```

### 3.2 n8n — автоматичні workflow

**Workflow 1: Ранковий звіт (щодня о 08:00)**

```
┌──────────┐    ┌──────────────┐    ┌────────────┐    ┌──────────┐
│ Cron     │ →  │ HTTP Request │ →  │ Claude API │ →  │ Telegram │
│ 08:00    │    │ Meta Ads API │    │ "Склади    │    │ Надіслати│
│ Пн-Пт   │    │ get_insights │    │  звіт"     │    │ в чат    │
└──────────┘    └──────────────┘    └────────────┘    └──────────┘
                                          │
                                          ▼
                                    ┌────────────┐
                                    │ Notion API │
                                    │ Зберегти   │
                                    │ звіт       │
                                    └────────────┘
```

**Задачі в n8n:**
```
□ Workflow 1: Ранковий звіт
    Тригер: Cron, 08:00, Пн-Пт
    Кроки:
    1. HTTP Request → Meta Ads API (get_insights, yesterday)
    2. Claude API → "Проаналізуй ці дані, склади короткий звіт"
    3. Telegram → Надіслати звіт у груповий чат
    4. Notion → Створити запис у Dashboard DB
    5. IF CPL > target × 1.5 → Окремий алерт "⚠️ Проблема!"

□ Workflow 2: Алерт при проблемі
    Тригер: Cron, кожні 4 години (10:00, 14:00, 18:00)
    Кроки:
    1. HTTP Request → Meta Ads API (get_insights, today)
    2. IF spend > daily_budget × 0.5 AND leads == 0 → CRITICAL
    3. IF CPL > target × 2 → HIGH
    4. Telegram → "@маркетолог ⚠️ Проблема з {акаунт}!"

□ Workflow 3: Тижневий звіт
    Тригер: Cron, П'ятниця 17:00
    Кроки:
    1. HTTP Request → Meta Ads API (get_insights, last 7 days)
    2. Claude API → Детальний тижневий звіт
    3. Notion → Створити сторінку з повним аналізом
    4. Telegram → Надіслати підсумок + посилання на Notion

□ Workflow 4: Місячний звіт
    Тригер: Cron, 1-ше число місяця, 10:00
    Кроки:
    1. HTTP Request → Meta Ads API (get_insights, last 30 days)
    2. Claude API → Місячний аналіз з рекомендаціями
    3. Notion → Повний звіт з графіками
    4. Telegram → CEO: підсумок + посилання на Notion
```

---

## Фаза 4: Telegram Mini App (5-7 днів, опціонально)

### 4.1 Що будуємо

Інтерактивний веб-дашборд всередині Telegram з:
- Таблицями (сортування, фільтри)
- Графіками (тренди CPL, витрати)
- Вибором акаунту і періоду
- Кнопками дій (оптимізувати, звіт)

### 4.2 Технічний стек

```
Frontend:   React + TypeScript + Vite
UI:         @telegram-apps/telegram-ui (нативний TG вигляд)
Таблиці:    TanStack Table (інтерактивні, сортування)
Графіки:    Chart.js або Recharts
API:        Next.js API Routes або FastAPI
Хостинг:    Vercel (безкоштовно)
SDK:        @tma.js/sdk (Telegram Mini Apps SDK)
```

**Задачі:**
```
□ Створити React проект з TMA шаблону:
    npx degit Telegram-Mini-Apps/reactjs-template ads-mini-app
    cd ads-mini-app && npm install

□ Додати компоненти:
    - DashboardPage: таблиця акаунтів + графік CPL
    - AccountPage: деталі кампаній + Health Score
    - ReportPage: звіт за обраний період
    - ChatPage: чат з агентом

□ Створити API endpoint (FastAPI на VPS):
    - GET /api/dashboard?period=7d
    - GET /api/account/{id}?period=7d
    - POST /api/chat (для спілкування з Claude)

□ Задеплоїти frontend на Vercel
□ Підключити Mini App до бота:
    - @BotFather → /mybots → Bot Settings → Menu Button
    - URL: https://ads-mini-app.vercel.app
```

---

## Розподіл ролей та доступів

### Telegram — хто що може

| Роль | Telegram ID | Що може робити |
|------|------------|----------------|
| CEO | 111111111 | /dashboard, /ads-reporter, запитання |
| Маркетолог | 222222222 | ВСІ команди (повний доступ) |
| Контент | 333333333 | /creative-copywriter, /creative-image-generator |
| Аналітик | 444444444 | /dashboard, /ads-reporter, /creative-analyzer |

**Як обмежити доступ:**

В `claude-code-telegram` можна налаштувати через middleware:

```python
# Обмеження команд по ролях
ROLE_PERMISSIONS = {
    111111111: ["dashboard", "ads-reporter", "chat"],           # CEO
    222222222: ["*"],                                            # Маркетолог — все
    333333333: ["creative-copywriter", "creative-image-generator"], # Контент
    444444444: ["dashboard", "ads-reporter", "creative-analyzer"],  # Аналітик
}
```

### Notion — хто що бачить

| Роль | Доступ в Notion |
|------|----------------|
| CEO | Full access — все бачить |
| Маркетолог | Full access — все бачить і редагує |
| Контент | Тільки "Креативи" база |
| Аналітик | Dashboard + Історія (read only) |

---

## Безпека

### Критичні правила

```
□ SSH тільки по ключу (вимкнути password auth)
□ Файрвол (ufw): тільки 22, 443
□ .env файл: chmod 600, не в git
□ ALLOWED_USERS: тільки 4 ID, ніхто інший не може писати боту
□ Meta Access Token: System User Token з обмеженими правами
□ Anthropic API Key: встановити spending limit ($50-100/міс)
□ n8n: за паролем, HTTPS only
□ Бекапи: щоденні (конфіги + history/)
□ Логування: всі дії бота → history/ + Notion
```

### Spending limits (контроль витрат)

| Сервіс | Ліміт/міс | Як контролювати |
|--------|-----------|-----------------|
| Anthropic API | $50-100 | console.anthropic.com → Usage Limits |
| VPS | $12-24 фіксовано | Оплата щомісяця |
| Meta Ads (рекл. бюджет) | По вашому плану | Через safety_rules.md |
| Notion | Безкоштовно (free plan) | — |
| Vercel | Безкоштовно (hobby) | — |

---

## Бюджет

### Щомісячні витрати

| Стаття | Міс. вартість | Коментар |
|--------|---------------|----------|
| VPS (Hetzner CX31) | €8 (~$9) | 4 vCPU, 8GB RAM |
| Anthropic API (Claude) | $30-80 | Залежить від використання |
| Домен (опціонально) | $1/міс | Для n8n і Mini App |
| **РАЗОМ** | **$40-90/міс** | На всю команду з 4 людей |

### Порівняння з альтернативами

| Варіант | Ціна/міс | Що отримуєте |
|---------|----------|--------------|
| **Наше рішення (VPS)** | **$40-90** | Бот + дашборд + Notion + алерти |
| Claude for Teams | $125 | Тільки термінал, без GUI |
| 4 × Claude Max | $400-800 | Тільки термінал |
| AdAmigo.ai | $99+ | Обмежений функціонал |
| Madgicx | $44+ | Без AI чату |

---

## Тайм-лайн

```
Тиждень 1 (Фаза 1):
├── День 1:  VPS + базове налаштування
├── День 2:  Telegram бот + Claude Code
├── День 3:  MCP + ai-ads-agent конфіг
├── День 4:  Таблиці в Telegram (текст + картинки)
└── День 5:  Тестування з командою

Тиждень 2 (Фаза 2):
├── День 6:  Notion інтеграція — бази даних
├── День 7:  Notion — автоматичні звіти
└── День 8:  Тестування Notion + бот

Тиждень 3 (Фаза 3):
├── День 9:  n8n — встановлення
├── День 10: n8n — ранковий звіт + алерти
└── День 11: n8n — тижневий/місячний звіти

Тиждень 4+ (Фаза 4, опціонально):
├── День 12-15: Mini App — frontend
├── День 16-17: Mini App — API
└── День 18:    Деплой + тестування
```

---

## Чеклист для передачі розробнику

```
ДОСТУПИ (що потрібно від замовника):
□ Meta Business Manager: App ID, App Secret, Access Token
□ Рекламні акаунти: Account ID для кожного акаунту
□ Page ID, Instagram Account ID, Pixel ID — для кожного акаунту
□ Telegram ID всіх 4 учасників команди
□ Notion workspace (створити якщо немає)
□ Домен (опціонально) — для n8n і Mini App
□ Бюджет на VPS і Claude API

ЩО РОЗРОБНИК РОБИТЬ:
□ Фаза 1: VPS + бот (3-5 днів)
□ Фаза 2: Notion (2-3 дні)
□ Фаза 3: n8n (2-3 дні)
□ Фаза 4: Mini App (5-7 днів, опціонально)
□ Документація: як користуватись для кожної ролі
□ Навчання: 30-хв сесія з командою

ЩО ЗАМОВНИК ОТРИМУЄ:
□ Telegram бот що працює 24/7
□ Notion з автоматичними звітами
□ Ранкові дайджести в Telegram
□ Алерти при проблемах
□ Інструкції для кожного співробітника
□ (Опціонально) Mini App з інтерактивним дашбордом
```

---

## Джерела

**OpenClaw:**
- [OpenClaw GitHub (273K+ зірок)](https://github.com/openclaw/openclaw)
- [OpenClaw Documentation](https://docs.openclaw.ai)
- [OpenClaw Telegram Integration](https://docs.openclaw.ai/channels/telegram)
- [OpenClaw VPS Hosting Guide](https://docs.openclaw.ai/vps)
- [OpenClaw MCP Integration](https://gist.github.com/Rapha-btc/527d08acc523d6dcdb2c224fe54f3f39)
- [Deploy OpenClaw on $5 VPS](https://medium.com/@rentierdigital/i-deployed-my-own-openclaw-ai-agent-in-4-minutes-it-now-runs-my-life-from-a-5-server-8159e6cb41cc)
- [Awesome OpenClaw Skills](https://github.com/VoltAgent/awesome-openclaw-skills)

**claude-code-telegram:**
- [claude-code-telegram (GitHub)](https://github.com/RichardAtCT/claude-code-telegram)
- [DigitalOcean: Edit Code from Telegram](https://www.digitalocean.com/community/tutorials/edit-code-from-telegram)

**n8n + Notion:**
- [n8n + Claude + Telegram інтеграція](https://n8n.io/integrations/claude/and/telegram/)
- [n8n self-hosted Docker setup](https://github.com/flatmarstheory/selfhosted-n8n-telegram-bot)
- [Notion API Getting Started](https://developers.notion.com/docs/getting-started)
- [Notion Database Python](https://github.com/minwook-shin/notion-database)

**Telegram Mini App:**
- [Telegram Mini Apps Documentation](https://core.telegram.org/bots/webapps)
- [TMA React Template](https://github.com/Telegram-Mini-Apps/reactjs-template)
- [Telegram UI Kit](https://github.com/telegram-mini-apps-dev/TelegramUI)
