# Робота з cc-ruta з телефона і ноутбука

Проєкти живуть на сервері **cc.ruta.cam** (Hetzner, Claude Code вже встановлений).
Код нікуди не копіюється: сервер запускає Claude Code у режимі **Remote Control**,
і його сесія **cc-ruta** з'являється в Claude app / claude.ai/code. Пишеш задачу там —
Claude виконує її прямо на сервері.

## 1. Сервер — одна команда з ноутбука

```bash
ssh -t sergiy@cc.ruta.cam 'curl -fsSL https://raw.githubusercontent.com/ser222w/rutapolyana_directory/main/scripts/cc-ruta-setup.sh -o /tmp/cc-setup.sh && bash /tmp/cc-setup.sh'
```

`cc-ruta-setup.sh` (безпечно запускати повторно):
- ставить `~/cc-ruta-remote.sh`;
- позначає `~` довіреною папкою для Claude Code (без trust-запиту);
- створює systemd user service **cc-remote** — Remote Control сам стартує після перезавантаження;
- режим дозволів `auto` (автопідтвердження безпечних дій);
- налаштовує tmux під телефон (миша, великий history);
- показує статус Remote Control і VS Code Tunnel.

## 2. Ноутбук — одна команда

```bash
curl -fsSL https://raw.githubusercontent.com/ser222w/rutapolyana_directory/main/scripts/laptop-setup.sh -o /tmp/laptop-setup.sh && bash /tmp/laptop-setup.sh
```

Після цього (у новому терміналі):

| Команда | Що робить |
|---|---|
| `ssh cc` | SSH на сервер (keepalive, повторні підключення миттєві) |
| `ccr` | одразу в tmux-сесію Claude Remote Control на сервері |
| `ccs` | статус Remote Control і VS Code Tunnel |

Також: VS Code → `Remote-Tunnels: Connect to Tunnel` → **cc-ruta**, або claude.ai/code → сесія **cc-ruta**.

## 3. Телефон — нічого ставити не треба

| Що | Як |
|---|---|
| **Claude app** (основне) | вкладка Code → сесія **cc-ruta** → пишеш задачу |
| Редактор коду | Safari/Chrome → https://vscode.dev/tunnel/cc-ruta → «Add to Home Screen» |
| Термінал (опційно) | Termius → хост `cc.ruta.cam`, user `sergiy`, ключ ed25519 |

## Автопідтвердження

- На сервері Remote Control стартує з `--permission-mode auto`: читання, правки, тести, git
  проходять без питань, а небезпечні/незворотні дії класифікатор блокує.
- Повністю без перевірок (не рекомендовано — сервер має SSH до production):
  `CC_MODE=bypassPermissions bash /tmp/cc-setup.sh`
- У цьому репозиторії `.claude/settings.json` ставить `defaultMode: auto` для нових сесій.

## Керування на сервері

| Дія | Команда |
|---|---|
| Статус | `bash ~/cc-ruta-remote.sh status` |
| Подивитись / вийти | `bash ~/cc-ruta-remote.sh attach` → `Ctrl+B`, `D` |
| Перезапустити | `systemctl --user restart cc-remote` |
| Логи | `journalctl --user -u cc-remote -n 50` |
| Інша робоча папка | `CC_DIR=~/ruta-platform bash /tmp/cc-setup.sh` |
| Кожна сесія в окремому git worktree | `CC_SPAWN=worktree CC_DIR=~/ruta-platform bash /tmp/cc-setup.sh` |
