#!/usr/bin/env bash
# Install the pixel display bridge as a launchd service.
#
# WHY a wrapper .app: the bridge is a bundled macOS app (PixelBridge.app) that
# runs the FastAPI service. macOS only grants Bluetooth permission to processes
# through a GUI/TCC flow; a bare python binary spawned by launchd is always
# denied ("BLE is not authorized"). A proper .app bundle (with
# NSBluetoothAlwaysUsageDescription) gets its own "PixelBridge would like to
# use Bluetooth" prompt that CAN be granted, and the grant then persists for
# the launchd-spawned app.
#
# The service runs from ~/pixel-display-bridge (NOT this repo): macOS blocks
# launchd agents from reading iCloud Drive paths.
#
# Usage: ./install.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
RUN_DIR="$HOME/pixel-display-bridge"
APP="$RUN_DIR/PixelBridge.app"
PLIST="$HOME/Library/LaunchAgents/com.pixelbridge.idotmatrix.plist"
C_SRC="$(mktemp /tmp/pixelbridge.XXXXXX.c)"
trap 'rm -f "$C_SRC"' EXIT

echo "==> Deploying bridge files to $RUN_DIR"
rsync -a --delete --exclude .venv --exclude logs --exclude __pycache__ "$REPO_DIR/" "$RUN_DIR/"

echo "==> Ensuring Python venv"
if [ ! -x "$RUN_DIR/.venv/bin/python" ]; then
    python3 -m venv "$RUN_DIR/.venv"
fi
"$RUN_DIR/.venv/bin/python" -m pip install -q --upgrade pip
"$RUN_DIR/.venv/bin/python" -m pip install -q -r "$RUN_DIR/requirements.txt"

echo "==> Building PixelBridge.app wrapper"
mkdir -p "$APP/Contents/MacOS" "$RUN_DIR/logs"
cat > "$APP/Contents/Info.plist" <<'PINFO'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>PixelBridge</string>
    <key>CFBundleIdentifier</key>
    <string>com.pixelbridge.agent</string>
    <key>CFBundleName</key>
    <string>PixelBridge</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSBluetoothAlwaysUsageDescription</key>
    <string>Controls your iDotMatrix pixel display over Bluetooth.</string>
    <key>NSBluetoothPeripheralUsageDescription</key>
    <string>Controls your iDotMatrix pixel display over Bluetooth.</string>
</dict>
</plist>
PINFO

cat > "$C_SRC" <<CEOF
#include <stdlib.h>
#include <stdio.h>
#include <unistd.h>
#include <sys/wait.h>

int main(void) {
    const char *cmd =
        "cd __RUN_DIR__ && "
        "exec .venv/bin/python -m uvicorn app:app "
        "--host 127.0.0.1 --port 8000 "
        ">> __RUN_DIR__/logs/app-bridge.log 2>&1 < /dev/null";
    for (;;) {
        pid_t pid = fork();
        if (pid == 0) { execl("/bin/sh", "sh", "-c", cmd, (char *)NULL); _exit(127); }
        int status;
        waitpid(pid, &status, 0);
        sleep(3);
    }
    return 0;
}
CEOF
sed -i '' "s|__RUN_DIR__|$RUN_DIR|g" "$C_SRC"
if command -v clang >/dev/null 2>&1; then
    clang -O2 -o "$APP/Contents/MacOS/PixelBridge" "$C_SRC"
else
    echo "ERROR: clang not found (install Command Line Tools: xcode-select --install)" >&2
    exit 1
fi
codesign --force --deep --sign - "$APP" 2>/dev/null || true

echo "==> Installing launchd agent"
sed -e "s|__APP_PATH__|$APP|" -e "s|__BRIDGE_DIR__|$RUN_DIR|" \
    "$REPO_DIR/launchd/com.pixelbridge.idotmatrix.plist.template" > "$PLIST"

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
sleep 3

echo "==> Done. Check:"
echo "  launchctl list | grep pixelbridge"
echo "  curl -H \"X-API-Key: <key>\" http://127.0.0.1:8000/status   -> connected: true"
echo
echo "First time only: macOS asks \"PixelBridge would like to use Bluetooth\" -> Allow."