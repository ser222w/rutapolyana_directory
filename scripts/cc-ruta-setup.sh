#!/bin/bash
# Одноразове налаштування cc-ruta (cc.ruta.cam) для роботи з телефона і ноутбука.
# Запуск на сервері як sergiy (безпечно запускати повторно):
#   bash cc-ruta-setup.sh
#
# Що робить:
#   1. Ставить ~/cc-ruta-remote.sh (керування Remote Control сесією)
#   2. Позначає робочу папку як довірену для Claude Code (щоб не питав trust)
#   3. Створює systemd user service cc-remote — Remote Control стартує сам
#      після перезавантаження, живе в tmux-сесії cc-remote
#   4. Зручний tmux для телефона (миша, великий history)
#   5. Показує статус: Remote Control, VS Code Tunnel, lingering

set -euo pipefail

BASE_URL="${BASE_URL:-https://raw.githubusercontent.com/ser222w/rutapolyana_directory/main/scripts}"
CC_DIR="${CC_DIR:-$HOME}"
CC_MODE="${CC_MODE:-auto}"
CC_SPAWN="${CC_SPAWN:-same-dir}"

ok()   { echo "  ✅ $*"; }
warn() { echo "  ⚠️  $*"; }

echo "== 1. Перевірка інструментів"
for bin in claude tmux jq curl; do
  command -v "$bin" >/dev/null && ok "$bin" || { warn "$bin не знайдено"; exit 1; }
done

echo "== 2. Скрипт керування ~/cc-ruta-remote.sh"
curl -fsSL "$BASE_URL/cc-ruta-remote.sh" -o ~/cc-ruta-remote.sh
chmod +x ~/cc-ruta-remote.sh
ok "встановлено"

echo "== 3. Trust для $CC_DIR"
CLAUDE_JSON="$HOME/.claude.json"
[ -f "$CLAUDE_JSON" ] || echo '{}' > "$CLAUDE_JSON"
cp "$CLAUDE_JSON" "$CLAUDE_JSON.bak"
jq --arg d "$CC_DIR" '.projects[$d].hasTrustDialogAccepted = true' "$CLAUDE_JSON.bak" > "$CLAUDE_JSON"
ok "позначено довіреною (бекап: $CLAUDE_JSON.bak)"

echo "== 4. systemd user service cc-remote"
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/cc-remote.service <<UNIT
[Unit]
Description=Claude Code Remote Control (cc-ruta) у tmux
After=network-online.target

[Service]
Type=forking
WorkingDirectory=$CC_DIR
Environment=PATH=$HOME/.bun/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/tmux new-session -d -s cc-remote -c $CC_DIR "claude remote-control --name cc-ruta --permission-mode $CC_MODE --spawn $CC_SPAWN; exec bash"
ExecStop=/usr/bin/tmux kill-session -t cc-remote
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
UNIT
# Якщо раніше запускали вручну — прибираємо стару tmux-сесію, далі керує systemd
tmux kill-session -t cc-remote 2>/dev/null || true
systemctl --user daemon-reload
systemctl --user enable --now cc-remote.service
ok "увімкнено (стартує сам після перезавантаження)"

if loginctl show-user "$USER" -p Linger 2>/dev/null | grep -q "Linger=yes"; then
  ok "lingering увімкнено"
else
  sudo loginctl enable-linger "$USER" && ok "lingering увімкнено"
fi

echo "== 5. tmux для телефона"
if ! grep -q "cc-ruta-setup" ~/.tmux.conf 2>/dev/null; then
  cat >> ~/.tmux.conf <<'TMUX'
# --- cc-ruta-setup ---
set -g mouse on
set -g history-limit 50000
set -g default-terminal "tmux-256color"
setw -g aggressive-resize on
TMUX
  tmux source-file ~/.tmux.conf 2>/dev/null || true
  ok "додано ~/.tmux.conf"
else
  ok "вже налаштовано"
fi

echo "== 6. Статус"
sleep 5
if tmux has-session -t cc-remote 2>/dev/null; then
  ok "Remote Control працює (tmux: cc-remote)"
  tmux capture-pane -pt cc-remote | grep -v '^$' | tail -5 | sed 's/^/     /'
else
  warn "Remote Control не запустився: journalctl --user -u cc-remote -n 30"
fi
systemctl is-active --quiet code-tunnel 2>/dev/null \
  && ok "VS Code Tunnel працює: https://vscode.dev/tunnel/cc-ruta" \
  || warn "VS Code Tunnel не активний: sudo systemctl restart code-tunnel"

cat <<DONE

Готово. Далі:
  📱 Телефон  — Claude app → Code → сесія «cc-ruta»
  💻 Ноутбук  — claude.ai/code → «cc-ruta», або VS Code → Remote-Tunnels → cc-ruta
  Якщо сесії не видно: bash ~/cc-ruta-remote.sh attach (Ctrl+B, D — вийти)
DONE
