#!/usr/bin/env bash
set -euo pipefail

# Depois de publicar, troque pela URL HTTPS do seu serviço Render.
SERVIDOR="https://SEU-SERVICO.onrender.com"
URL="${SERVIDOR}/?modo=monitor"

if [[ "$SERVIDOR" == *"SEU-SERVICO"* ]]; then
  echo "Edite o arquivo e troque SERVIDOR pela URL HTTPS real da hospedagem."
  exit 1
fi

if command -v chromium-browser >/dev/null 2>&1; then
  BROWSER="chromium-browser"
elif command -v chromium >/dev/null 2>&1; then
  BROWSER="chromium"
else
  echo "Chromium nao foi encontrado. Instale/ative o Chromium no Raspberry Pi OS."
  exit 1
fi

exec "$BROWSER" --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble "$URL"
