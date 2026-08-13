#!/usr/bin/env bash
# Install the Home Assistant room-automation hub as a launchd service.
#
# Deploys to $HOME/home-assistant (NOT this repo): macOS blocks launchd
# agents from reading iCloud Drive paths, and Docker bind-mounts must not
# point into iCloud either. Same rule that applies to ~/pixel-display-bridge.
#
# Two container backends are supported on macOS (Air has 8 GB -> keep it
# light): colima (recommended, ~0.5 GB idle VM) or Docker Desktop (GUI,
# ~2-2.5 GB idle). All commands below are the docker CLI either way.
#
# Usage: ./install.sh [colima|docker]     (default: colima)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
RUN_DIR="$HOME/home-assistant"
PLIST="$HOME/Library/LaunchAgents/com.saswatas.homeassistant.plist"
BACKEND="${1:-colima}"

case "$BACKEND" in
    colima|docker) ;;
    *) echo "ERROR: backend must be 'colima' or 'docker'" >&2; exit 1 ;;
esac

echo "==> Deploying hub files to $RUN_DIR"
# config/ + mosquitto data/ and logs/ are runtime state; never wipe them on
# a reinstall (rsync --delete would otherwise drop the user's HA config).
mkdir -p "$RUN_DIR"
rsync -a --delete \
    --exclude config --exclude 'mosquitto/config' --exclude 'mosquitto/data' \
    --exclude 'mosquitto/log' --exclude logs \
    "$REPO_DIR/" "$RUN_DIR/"
mkdir -p "$RUN_DIR/config" "$RUN_DIR/logs" \
    "$RUN_DIR/mosquitto/config" "$RUN_DIR/mosquitto/data" "$RUN_DIR/mosquitto/log"

echo "==> Seeding config if absent"
if [ ! -f "$RUN_DIR/mosquitto/config/mosquitto.conf" ]; then
    cp "$RUN_DIR/mosquitto.conf.example" "$RUN_DIR/mosquitto/config/mosquitto.conf"
fi
if [ ! -f "$RUN_DIR/config/configuration.yaml" ]; then
    cat > "$RUN_DIR/config/configuration.yaml" <<'YAML'
# Home Assistant core config - seeded minimal; finish setup via the UI
# (first login -> onboarding, later Settings -> System -> General).
homeassistant:
  name: Room
  unit_system: metric
  currency: INR
  country: IN
  time_zone: Asia/Kolkata
  # funnel hostname must be allowed or HA answers 400 on this host
  external_url: https://saswatas-macbook-air.taile61337.ts.net:8443

default_config:
YAML
fi

echo "==> Writing start wrapper ($BACKEND backend)"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
if [ "$BACKEND" = "colima" ]; then
    if command -v colima >/dev/null 2>&1; then
        : # ok
    else
        echo "ERROR: colima not found. Install: brew install colima docker docker-compose" >&2
        exit 1
    fi
    cat > "$RUN_DIR/start.sh" <<'SH'
#!/bin/sh
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
RUN_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if ! colima status >/dev/null 2>&1; then
    colima start --cpu 2 --memory 4 >/dev/null 2>&1
fi
# wait for the docker daemon (max 120s)
i=0
while ! docker info >/dev/null 2>&1; do
    i=$((i + 1)); [ "$i" -ge 120 ] && break; sleep 1
done
docker-compose -f "$RUN_DIR/docker-compose.yml" up -d >/dev/null 2>&1
exit 0
SH
else
    if [ ! -d /Applications/Docker.app ]; then
        echo "ERROR: /Applications/Docker.app not found (install Docker Desktop first)" >&2
        exit 1
    fi
    cat > "$RUN_DIR/start.sh" <<'SH'
#!/bin/sh
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
RUN_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
/usr/bin/open -g /Applications/Docker.app 2>/dev/null
# wait for the docker daemon (max 120s)
i=0
while ! docker info >/dev/null 2>&1; do
    i=$((i + 1)); [ "$i" -ge 120 ] && break; sleep 1
done
docker-compose -f "$RUN_DIR/docker-compose.yml" up -d >/dev/null 2>&1
exit 0
SH
fi
chmod +x "$RUN_DIR/start.sh"
# secrets must not be world-readable; HA stores tokens under config/
chmod 700 "$RUN_DIR/config" 2>/dev/null || true

echo "==> Installing launchd agent"
sed "s|__RUN_DIR__|$RUN_DIR|g" \
    "$RUN_DIR/launchd/com.saswatas.homeassistant.plist.template" > "$PLIST"
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
sleep 3

echo
echo "==> Done. Verify:"
echo "  launchctl list | grep homeassistant"
echo "  docker-compose -f ~/home-assistant/docker-compose.yml ps   (both Up)"
echo
echo "If 'docker-compose' is not installed yet (colima backend):"
echo "  brew install colima docker docker-compose && ~/home-assistant/start.sh"
echo
echo "Next (needs your Tailscale on the Air):"
echo "  \"/Applications/Tailscale.app/Contents/MacOS/Tailscale\" funnel --bg --yes --https=8443 http://127.0.0.1:8123"
echo "  then open: https://saswatas-macbook-air.taile61337.ts.net:8443"
echo
echo "First time only: finish HA onboarding in the browser, then install HACS."