# Керування cc-ruta звідси (без копіювання проєктів)

Проєкти живуть на сервері **cc.ruta.cam** (Hetzner, Claude Code вже встановлений).
Замість копіювання коду сюди — сервер запускає Claude Code у режимі **Remote Control**,
і його сесії з'являються в Claude app / claude.ai/code. Ти пишеш задачу там — Claude
виконує її прямо на сервері, в потрібному проєкті.

## Одноразове налаштування (на сервері)

```bash
ssh sergiy@cc.ruta.cam
curl -fsSL https://raw.githubusercontent.com/ser222w/rutapolyana_directory/main/scripts/cc-ruta-remote.sh -o ~/cc-ruta-remote.sh
bash ~/cc-ruta-remote.sh          # старт у фоні (tmux: cc-remote)
bash ~/cc-ruta-remote.sh attach   # перший раз: прийняти trust для папки, потім Ctrl+B, D
```

Готово — у Claude app з'явиться сесія **cc-ruta**.

## Автопідтвердження

- На сервері скрипт стартує з `--permission-mode auto`: безпечні дії (читання, правки,
  тести, git) проходять без питань, а небезпечні/незворотні класифікатор блокує.
- Повністю без перевірок: `CC_MODE=bypassPermissions bash ~/cc-ruta-remote.sh`
  (не рекомендовано — сервер має SSH до production).
- У цьому репозиторії `.claude/settings.json` ставить `defaultMode: auto` для нових сесій.

## Корисне

| Дія | Команда |
|---|---|
| Статус | `bash ~/cc-ruta-remote.sh status` |
| Зупинити | `bash ~/cc-ruta-remote.sh stop` |
| Інша робоча папка | `CC_DIR=~/ruta-platform bash ~/cc-ruta-remote.sh` |
| Кожна сесія в окремому git worktree | `CC_SPAWN=worktree CC_DIR=~/ruta-platform bash ~/cc-ruta-remote.sh` |

Після перезавантаження сервера — запусти `bash ~/cc-ruta-remote.sh` ще раз.
