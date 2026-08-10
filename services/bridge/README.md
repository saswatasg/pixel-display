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

One command does everything (deploy → venv → plist → load):

```sh
cd services/bridge
./install.sh
```

Why a copy to `~/pixel-display-bridge`? If the repo lives inside iCloud Drive, macOS denies
launchd agents access to iCloud-protected paths (`PermissionError ... pyvenv.cfg`). The script
deploys a runtime copy outside iCloud; the repo stays the source of truth — re-run `install.sh`
after bridge code changes. Manual fallback:

```sh
cd services/bridge
mkdir -p logs
# create the plist from the template (fill in __VENV_PYTHON__ and __BRIDGE_DIR__)
sed -e "s|__VENV_PYTHON__|$(pwd)/.venv/bin/python|" \
    -e "s|__BRIDGE_DIR__|$(pwd)|" \
    launchd/com.pixelbridge.idotmatrix.plist.template > ~/Library/LaunchAgents/com.pixelbridge.idotmatrix.plist
launchctl load ~/Library/LaunchAgents/com.pixelbridge.idotmatrix.plist
# check it:
launchctl list | grep pixelbridge
cat logs/bridge.log
# unload if needed:
launchctl unload ~/Library/LaunchAgents/com.pixelbridge.idotmatrix.plist
```

Notes:

- On first BLE connection, macOS may prompt to allow Bluetooth access for Python/uvicorn —
  approve it in System Settings > Privacy & Security > Bluetooth.
- KeepAlive + ThrottleInterval restart the process if it dies; the bridge itself also
  auto-reconnects the BLE link when the Mac wakes from sleep.
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
