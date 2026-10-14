#!/usr/bin/env bash
# Puts one setting into /opt/shop/backend.env without showing it on screen.
# Usage (on the server):  sudo /opt/shop/app/deploy/set-secret.sh RAZORPAY_KEY_SECRET
# Then apply it:          cd /opt/shop/app/deploy && sudo docker compose up -d backend
set -euo pipefail
ENV_FILE=/opt/shop/backend.env
name="${1:-}"
[[ "$name" =~ ^[A-Z][A-Z0-9_]*$ ]] || { echo "Usage: $0 SETTING_NAME   (for example RAZORPAY_KEY_SECRET)"; exit 1; }
read -rsp "Paste the value for $name (nothing will show), then press Enter: " value; echo
[[ -n "$value" ]] || { echo "Empty value. Nothing changed."; exit 1; }
[[ "$value" != *$'\n'* ]] || { echo "Value has a line break. Nothing changed."; exit 1; }
tmp=$(mktemp "$ENV_FILE.XXXXXX")
grep -v "^${name}=" "$ENV_FILE" > "$tmp" || true
printf '%s=%s\n' "$name" "$value" >> "$tmp"
chmod 600 "$tmp"; chown --reference="$ENV_FILE" "$tmp"
mv "$tmp" "$ENV_FILE"
echo "$name saved in $ENV_FILE (value not shown)."
