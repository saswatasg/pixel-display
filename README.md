# Pixel Display Controller

Web-based control for the APEX / iDotMatrix 32×32 pixel display, replacing the
manufacturer's app. Built as a modular device driver for a future home-automation platform.

```
┌─────────────────────┐   HTTPS   ┌──────────────────────┐   BLE   ┌────────────────┐
│  Web UI (Vercel)     │ ────────► │  Device Bridge        │ ──────► │  Pixel Display  │
│  Next.js (apps/web)  │ ◄──────── │  FastAPI (services/  │ ◄────── │  (IDM-xxxxxx)   │
└─────────────────────┘           │  bridge) on your Mac  │         └────────────────┘
                                  └──────────────────────┘
```

- **Web UI** — Next.js app, deploy on Vercel. Pure frontend; all device traffic goes through
  its API routes, so the bridge address/token never reach the browser.
- **Device Bridge** — local FastAPI service holding the BLE connection
  (`idotmatrix` library), exposed over your Tailscale network with HTTPS. Runs 24/7 via
  `launchd`.
- **Why two tiers:** BLE needs radio proximity. Vercel can't talk BLE; the Mac can. This is
  the same hub pattern Home Assistant uses, which is what makes it home-automation-ready.

## Quick start (macOS)

### 1. Bridge (on your Mac, near the display)

```sh
cd services/bridge
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp config.example.json config.json   # set apiKey; leave address "auto" for discovery
uvicorn app:app --host 127.0.0.1 --port 8000
```

Check it sees your display: `curl -H "X-API-Key: <key>" http://127.0.0.1:8000/status`
(`connected: true`). Then expose it over Tailscale: `tailscale serve --bg 8000`.

Full install as a launchd service + Tailscale setup: `services/bridge/README.md`.

### 2. Web app

```sh
cd apps/web
npm install
# .env.local:  BRIDGE_URL=http://127.0.0.1:8000   BRIDGE_API_KEY=<key>
npm run dev          # local
vercel deploy        # production; set BRIDGE_URL=https://<machine>.<tailnet>.ts.net
```

### 3. Presets

Stored in Vercel KV in production (set `KV_REST_API_URL` / `KV_REST_API_TOKEN`), or in a
local `data/presets.json` during development.

## Repo layout

```
├── apps/web/                # Next.js UI (Vercel)
│   ├── app/                 #   pages + API proxy routes (/api/status, /api/action/...)
│   ├── components/          #   mobile-first screens: Home, Text, Image, Clock, More
│   └── lib/                 #   client api, types, preset storage (KV + file fallback)
├── services/bridge/         # Python FastAPI device bridge
│   ├── app.py               #   REST + WS API, API-key auth
│   ├── device.py            #   BLE manager: reconnect loop, serialized action queue
│   ├── config.json          #   local config (gitignored)
│   └── launchd/             #   launchd plist template
└── docs/
    ├── api-contract.md      # concrete bridge API
    └── device-module-spec.md# generic device-module contract for the future platform
```

## Status

Phase 1 (MVP) complete: text, image, GIF, clock, brightness, screen power, flip,
chronograph, countdown, fullscreen color, animations, scoreboard, presets — all verified
against a real display. Remote access over Tailscale HTTPS, API-key auth, auto-reconnect.

## Security model

- Bridge binds `127.0.0.1` only; Tailscale is the transport to the outside.
- `X-API-Key` required on every endpoint even inside the tailnet.
- Web UI proxies every write through its own API routes (bridge URL/token stay server-side).
- Presets contain only names and display settings — no credentials.
