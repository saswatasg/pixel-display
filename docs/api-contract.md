# API Contract — Pixel Display Device Module

Base URL: `https://<bridge>` (localhost:8000 locally, `https://<machine>.<tailnet>.ts.net` over
Tailscale). Every request requires header `X-API-Key: <apiKey>` (except `/healthz` and the
WebSocket, which uses `?key=`).

All responses are JSON. POST bodies are JSON unless noted.

## Status & discovery

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/healthz` | Liveness probe (no auth). |
| GET | `/status` | Bridge + BLE connection health, last action/error. |
| GET | `/capabilities` | Full action schema — self-describing, for orchestrator UIs. |
| WS | `/ws/status?key=<apiKey>` | Push of `/status` every 5s while connected. |

`GET /status` shape:

```json
{
  "bridge": "online",
  "uptimeSec": 1242.1,
  "device": {
    "id": "pixel-display",
    "name": "IDM-pixel-display",
    "address": "42575DB3-9B30-89B6-4C24-AAFD0B6A046D",
    "connected": true,
    "displaySize": 32,
    "lastAction": { "action": "text", "at": 1786348134.0 },
    "lastError": null,
    "lastConnectedAt": 1786347440.8
  }
}
```

## Actions

| Method | Endpoint | Body |
|---|---|---|
| POST | `/actions/text` | `{ text, size?, mode?, speed?, color_mode?, color?, bg_color? }` |
| POST | `/actions/image` | multipart `file`, or `{ image_base64 }` |
| POST | `/actions/gif` | multipart `file`, or `{ gif_base64 }` |
| POST | `/actions/clock` | `{ style?, color?, format24h?, showDate?, syncTime? }` |
| POST | `/actions/brightness` | `{ value }` (5–100) |
| POST | `/actions/screen` | `{ power: "on" \| "off" }` |
| POST | `/actions/flip` | `{ enabled: bool }` |
| POST | `/actions/chronograph` | `{ mode: "reset" \| "start" \| "pause" \| "resume" }` |
| POST | `/actions/countdown` | `{ seconds }` or `{ cancel: true }` |
| POST | `/actions/fullscreen-color` | `{ color: "#RRGGBB" }` |
| POST | `/actions/animation` | `{ style: 0-6, colors?: ["#RRGGBB", ...] }` (2–7 colors) |
| POST | `/actions/scoreboard` | `{ score1, score2 }` (0–999) |
| POST | `/actions/sync-time` | `{}` |
| POST | `/actions/reset` | `{}` |

### Action details

**text** — `size` 8–24 (device-rendered, not CSS px). `mode`: 0 static, 1 marquee, 2 reversed
marquee, 3 vertical rise, 4 vertical lower, 5 blink, 6 fade, 7 tetris, 8 fill. `speed` 1–100
(default 95, higher = faster). `color_mode`: 0 white, 1 custom `color`, 3 rainbow.
`bg_color`: optional 6-digit hex; when present, `text_bg_mode=1` is used.

**image / gif** — bridge re-encodes to the configured `displaySize` (32) before uploading.
GIFs are re-encoded per-frame with nearest-neighbor scaling; on decoding errors the bridge
falls back to raw upload.

**clock** — `style` 0–7 (device clock faces). `syncTime: true` (default) also pushes the
bridge's current time to the device.

**animation** — device effect engine. Styles: 0 graduated horizontal rainbow, 1 random colored
pixels on black, 2 random white pixels on changing background, 3 vertical rainbow, 4 diagonal
right rainbow, 5 diagonal left rainbow on black, 6 random colored pixels. Omitting `colors`
uses a default 6-color cycle.

### Response shape

```json
{ "ok": true, "sent": true, "action": "text", "chars": 11 }
```

Errors return non-2xx with `{ "detail": "..." }` (401 auth, 400 validation, 502 bridge/device
failure, 504 queue timeout).

**Semantics of `sent`:** BLE writes to this display are fire-and-forget — the device has no
command-level acknowledgement. `sent: true` means the bytes reached the radio; it does not
claim the display rendered it. A dropped link mid-write returns an error instead.

## Generic device-module interface

The same functionality is exposed under the orchestration-friendly contract that any future
device module will share:

| Method | Endpoint | Maps to |
|---|---|---|
| GET | `/devices/{id}` | metadata + state |
| GET | `/devices/{id}/capabilities` | `/capabilities` |
| GET | `/devices/{id}/status` | `/status` |
| POST | `/devices/{id}/actions/{action}` | `/actions/{action}` |

Action payloads are identical. Full contract in [`device-module-spec.md`](device-module-spec.md).

## Concurrency

Actions are serialized: the bridge runs one BLE write at a time from a queue
(60s timeout per action). Sending many commands in a burst is safe; they execute in order.

## Upload limits

Multipart and base64 uploads are capped at 5 MB.