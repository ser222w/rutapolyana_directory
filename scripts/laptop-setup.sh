#!/bin/bash
# Налаштування ноутбука (Mac/Linux) для швидкого доступу до cc-ruta.
# Безпечно запускати повторно:  bash laptop-setup.sh
#
# Після цього:
#   ssh cc      — SSH на сервер (з keepalive, не відвалюється)
#   ccr         — одразу в tmux-сесію Remote Control на сервері
#   ccs         — статус сервера

set -euo pipefail

SSH_CONFIG="$HOME/.ssh/config"
mkdir -p ~/.ssh && chmod 700 ~/.ssh
touch "$SSH_CONFIG" && chmod 600 "$SSH_CONFIG"

if ! grep -q "cc-ruta (laptop-setup.sh)" "$SSH_CONFIG"; then
  cat >> "$SSH_CONFIG" <<'SSH'

# --- cc-ruta (laptop-setup.sh) ---
Host cc cc-ruta
  HostName cc.ruta.cam
  User sergiy
  IdentityFile ~/.ssh/id_ed25519
  ServerAliveInterval 30
  ServerAliveCountMax 4
  ControlMaster auto
  ControlPath ~/.ssh/cm-%r@%h:%p
  ControlPersist 10m
SSH
  echo "✅ ~/.ssh/config: додано Host cc"
else
  echo "✅ ~/.ssh/config: Host cc вже є"
fi

case "${SHELL:-}" in
  */zsh) RC="$HOME/.zshrc" ;;
  *)     RC="$HOME/.bashrc" ;;
esac

if ! grep -q "cc-ruta aliases" "$RC" 2>/dev/null; then
  cat >> "$RC" <<'RCEOF'

# --- cc-ruta aliases (laptop-setup.sh) ---
alias ccr='ssh -t cc "tmux attach -t cc-remote 2>/dev/null || { bash ~/cc-ruta-remote.sh start && tmux attach -t cc-remote; }"'
alias ccs='ssh cc "bash ~/cc-ruta-remote.sh status; systemctl is-active code-tunnel"'
RCEOF
  echo "✅ $RC: додано alias ccr, ccs (відкрий новий термінал)"
else
  echo "✅ $RC: aliases вже є"
fi

ssh -o BatchMode=yes -o ConnectTimeout=10 cc true \
  && echo "✅ SSH до cc.ruta.cam працює" \
  || echo "⚠️  SSH не підключився — перевір ключ ~/.ssh/id_ed25519"
