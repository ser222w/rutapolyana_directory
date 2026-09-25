#!/bin/bash
# Запускає Claude Code на cc-ruta (cc.ruta.cam) у режимі Remote Control,
# щоб керувати проєктами сервера з Claude app / claude.ai/code без копіювання коду.
#
# Використання (на сервері, як sergiy):
#   bash cc-ruta-remote.sh          # старт у фоні (tmux-сесія cc-remote)
#   bash cc-ruta-remote.sh attach   # подивитись/прийняти trust-запит
#   bash cc-ruta-remote.sh stop     # зупинити
#   bash cc-ruta-remote.sh status   # чи працює
#
# Налаштування через змінні середовища:
#   CC_DIR   — робоча папка (за замовчуванням $HOME, де лежать усі проєкти)
#   CC_MODE  — режим дозволів: auto (за замовчуванням), acceptEdits, bypassPermissions
#   CC_SPAWN — same-dir (за замовчуванням) або worktree

set -euo pipefail

SESSION="cc-remote"
CC_DIR="${CC_DIR:-$HOME}"
CC_MODE="${CC_MODE:-auto}"
CC_SPAWN="${CC_SPAWN:-same-dir}"

# Якщо встановлено через cc-ruta-setup.sh — керуємо через systemd
UNIT="$HOME/.config/systemd/user/cc-remote.service"

case "${1:-start}" in
  start)
    if tmux has-session -t "$SESSION" 2>/dev/null; then
      echo "Вже працює. Подивитись: bash $0 attach"
      exit 0
    fi
    if [ -f "$UNIT" ]; then
      systemctl --user start cc-remote.service
      echo "Запущено через systemd (cc-remote)."
      exit 0
    fi
    tmux new-session -d -s "$SESSION" -c "$CC_DIR" \
      "claude remote-control --name cc-ruta --permission-mode $CC_MODE --spawn $CC_SPAWN; exec bash"
    echo "Запущено в tmux-сесії '$SESSION' (папка: $CC_DIR, режим: $CC_MODE)."
    echo "Перший запуск: bash $0 attach — прийми trust для папки, потім Ctrl+B, D."
    ;;
  attach)
    tmux attach -t "$SESSION"
    ;;
  stop)
    [ -f "$UNIT" ] && systemctl --user stop cc-remote.service 2>/dev/null
    tmux kill-session -t "$SESSION" 2>/dev/null && echo "Зупинено." || echo "Не було запущено."
    ;;
  status)
    tmux has-session -t "$SESSION" 2>/dev/null && echo "Працює." || echo "Не працює."
    ;;
  *)
    echo "Команди: start | attach | stop | status"
    exit 1
    ;;
esac
