#!/usr/bin/env bash
# Install the pixel display bridge as a launchd service.
#
# The bridge is deployed to ~/pixel-display-bridge (NOT the repo folder): macOS
# blocks launchd agents from reading iCloud Drive paths, so a copy outside
# iCloud is used as the runtime location. The repo remains the source of truth.
#
# Usage: ./install.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
RUN_DIR="$HOME/pixel-display-bridge"
PLIST="$HOME/Library/LaunchAgents/com.pixelbridge.idotmatrix.plist"

echo "==> Deploying bridge files to $RUN_DIR"
rsync -a --delete --exclude .venv --exclude logs --exclude __pycache__ "$REPO_DIR/" "$RUN_DIR/"

echo "==> Ensuring Python venv"
if [ ! -x "$RUN_DIR/.venv/bin/python" ]; then
    python3 -m venv "$RUN_DIR/.venv"
fi
"$RUN_DIR/.venv/bin/python" -m pip install -q --upgrade pip
"$RUN_DIR/.venv/bin/python" -m pip install -q -r "$RUN_DIR/requirements.txt"

echo "==> Installing launchd agent"
mkdir -p "$RUN_DIR/logs"
sed -e "s|__VENV_PYTHON__|$RUN_DIR/.venv/bin/python|" \
    -e "s|__BRIDGE_DIR__|$RUN_DIR|" \
    "$REPO_DIR/launchd/com.pixelbridge.idotmatrix.plist.template" > "$PLIST"

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
sleep 5

echo "==> Done. Status:"
launchctl list | grep pixelbridge || true
echo "Logs: $RUN_DIR/logs/bridge.log"
echo
echo "If the display does not connect, allow Bluetooth for python:"
echo "  System Settings > Privacy & Security > Bluetooth > enable Python"
