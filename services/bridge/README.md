# Pixel Display Bridge

Local FastAPI service that talks BLE to the APEX/iDotMatrix 32x32 display via the
[`idotmatrix`](https://github.com/derkalle4/python3-idotmatrix-library) library, and exposes a
REST + WebSocket API for the web UI (or any future orchestrator).

## Setup (macOS)

```sh
cd services/bridge
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp config.example.json config.json
```

### Config

Edit `config.json`:

- `apiKey` — generate one: `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`. This
  key is required in the `X-API-Key` header on every request.
- `address` — leave `"auto"` to auto-discover your display (it advertises as `IDM-*`), or paste
  the exact MAC/UUID. Find it with: `python3 -c "import asyncio; from idotmatrix import ConnectionManager; print(asyncio.run(ConnectionManager.scan()))"`
- `port` — the bridge listens on `127.0.0.1` only. It must never bind a public interface; all
  remote access goes through Tailscale (below).

## Run (foreground, first test)

```sh
uvicorn app:app --host 127.0.0.1 --port 8000
```

Verify: `curl -H "X-API-Key: <key>" http://127.0.0.1:8000/status` → bridge online, display
connected (or `lastError` if not).

First smoke test of the display: `curl -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" -d '{"text":"hi"}' http://127.0.0.1:8000/actions/text`

## Install as a launchd service (survives reboots/logouts)

One command does everything (deploy → venv → wrapper app → plist → load):

```sh
cd services/bridge
./install.sh
```

The bridge runs wrapped in a **PixelBridge.app** bundle. This is required on macOS: a bare
Python binary spawned by launchd is always denied Bluetooth access ("BLE is not authorized"),
because there's no GUI/TCC flow for it. A proper `.app` (with `NSBluetoothAlwaysUsageDescription`)
gets its own *"PixelBridge would like to use Bluetooth"* prompt — allow it once and the grant
sticks for the background service. The `.app`'s embedded launcher runs uvicorn and restarts it
if it ever exits.

Two locations involved:

- `~/Library/LaunchAgents/com.pixelbridge.idotmatrix.plist` — the launchd job: `open -g
  PixelBridge.app` at login (RunAtLoad).
- `~/pixel-display-bridge/` — runtime copy of the bridge + the `.app`. If the repo lives
  inside iCloud Drive, macOS denies launchd agents access to iCloud-protected paths
  (`PermissionError ... pyvenv.cfg`), so the runtime copy lives outside iCloud. Re-run
  `./install.sh` after bridge code changes.

Check / unload:

```sh
launchctl list | grep pixelbridge
launchctl unload ~/Library/LaunchAgents/com.pixelbridge.idotmatrix.plist   # stop
```

Other notes:

- If you reinstall and the display doesn't connect: System Settings > Privacy & Security >
  Bluetooth — re-launch the app once or allow "PixelBridge" if listed.
- The bridge auto-reconnects the BLE link when the Mac wakes from sleep and resets a stale
  Bluetooth stack after 3 failed attempts (fresh CoreBluetooth instance).
- The Mac must be awake (or scheduled to stay awake) for remote control to work.

## Remote access via Tailscale

The bridge listens on localhost, so the Vercel app can't reach it directly. Expose it over your
tailnet with HTTPS:

```sh
tailscale serve --bg 8000
# or to also give it a public URL (exit-node style exposure):
# tailscale serve --bg --https=443 8000
tailscale serve status
```

This gives you `https://<machine-name>.<tailnet>.ts.net` — set that as `BRIDGE_URL` in the web
app's Vercel env vars (include `https://`). Requests from Vercel to that URL are already HTTPS,
and the bridge still requires the `X-API-Key`, so the tailnet is defense-in-depth, not the only
protection.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/status` | Bridge + BLE connection health |
| GET | `/capabilities` | Supported actions + JSON schemas (orchestrator-ready) |
| GET | `/healthz` | Liveness probe |
| POST | `/actions/text` | `{ text, size, mode, speed, color_mode, color, bg_color }` |
| POST | `/actions/image` | multipart `file` OR `{ image_base64 }` |
| POST | `/actions/gif` | multipart `file` OR `{ gif_base64 }` |
| POST | `/actions/clock` | `{ style: 0-7, color, format24h, showDate, syncTime }` |
| POST | `/actions/brightness` | `{ value: 5-100 }` |
| POST | `/actions/screen` | `{ power: "on"|"off" }` |
| POST | `/actions/flip` | `{ enabled }` |
| POST | `/actions/chronograph` | `{ mode: reset|start|pause|resume }` |
| POST | `/actions/countdown` | `{ seconds }` |
| POST | `/actions/fullscreen-color` | `{ color }` |
| POST | `/actions/animation` | `{ style: 0-6, colors: ["#RRGGBB", ...] }` |
| POST | `/actions/scoreboard` | `{ score1, score2 }` |
| POST | `/actions/sync-time` | `{}` |
| POST | `/actions/reset` | `{}` |
| WS | `/ws/status` | Live status push every 5s (`?key=<api key>`) |

Generic device-module interface (same handlers, orchestration-friendly):

`GET /devices/{id}`, `GET /devices/{id}/capabilities`, `GET /devices/{id}/status`,
`POST /devices/{id}/actions/{action}` — see `docs/device-module-spec.md`.

All endpoints require header `X-API-Key: <apiKey>`.

## What "sent" means

BLE writes to this display are fire-and-forget — the display has no command-level
acknowledgement. The bridge reports `sent: true` once the bytes reach the radio, not once the
display renders. If the link drops mid-write, the action returns an error and the UI shows it.
