# Device Module Spec — the generic contract

This is the contract every device module in the future home-automation platform implements.
The pixel display bridge (this repo) is the first implementation. A future smart plug, light,
or sensor module implements the exact same shape with its own actions.

## Principles

1. **Standard device interface.** One generic REST contract per device, regardless of type.
2. **Bridge-per-device-family.** A bridge is scoped to one hardware family (e.g. "iDotMatrix
   displays"). The future orchestrator runs one bridge process per family and aggregates.
3. **Self-describing.** `/capabilities` returns JSON schemas for every action, so an
   orchestrator UI can auto-generate controls with no hardcoded knowledge of the device.
4. **No UI in the bridge.** Device-specific UI lives in client apps, talking only to this API.
5. **Config isolated in the module.** Addresses, credentials, pairing data live in the
   bridge's own config — never in the shared frontend bundle.
6. **Reusable unit.** The bridge is a self-contained service that can be spawned as a
   subprocess/sidecar by an orchestrator (pip-installable, or a Docker image).

## Contract

### Metadata + state

```
GET /devices/{id}
```

```json
{
  "id": "pixel-display",
  "name": "IDM-pixel-display",
  "type": "idotmatrix-pixel-display",
  "connected": true,
  "state": { "brightness": null, "power": null, "address": "42575DB3-..." }
}
```

`type` is a stable identifier the orchestrator can use for icons/labels.

### Capabilities

```
GET /devices/{id}/capabilities
```

```json
{
  "deviceType": "idotmatrix-pixel-display",
  "deviceId": "pixel-display",
  "displaySize": 32,
  "actions": {
    "text": {
      "title": "Display text",
      "payloadSchema": { "type": "object", "properties": { ... }, "required": ["text"] }
    }
  }
}
```

`actions` is a map of action name → `{ title, payloadSchema }` where `payloadSchema` is a
JSON Schema (draft-07 subset). Orchestrator UIs render forms from this and send `POST
/devices/{id}/actions/{action}` with the resulting object.

### Live status

```
GET /devices/{id}/status
WS  /devices/{id}/status (future)
```

The bridge exposes `/ws/status` today; the generic WS path is reserved for the orchestrator
gateway. Implementations should push on change, and are allowed to push on a fixed interval.

### Actions

```
POST /devices/{id}/actions/{action}
Content-Type: application/json

{ ...payload matching the schema from /capabilities... }
```

Response:

```json
{ "ok": true, "sent": true, "action": "text", ...module-specific fields }
```

- `ok: false` → the action did not execute; `error` explains why.
- `sent: true` → delivered to hardware. Modules must not over-claim: if the hardware cannot
  acknowledge rendering, say so in the module docs (see pixel display notes).

## Module checklist (for new device families)

- [ ] Implements `GET /devices/{id}`, `/capabilities`, `/status`, `POST .../actions/{action}`.
- [ ] `/capabilities` fully describes every action it accepts.
- [ ] Own config file for address/credentials; nothing device-specific in shared frontend code.
- [ ] Reconnect logic and truthful connection status (no false "sent").
- [ ] Docs: API contract + hardware quirks (per this repo's `docs/api-contract.md`).
- [ ] Runnable as a standalone service (systemd/launchd/Docker).

## Pixel display implementation notes

- Actions available: `text`, `image`, `gif`, `clock`, `brightness`, `screen`, `flip`,
  `chronograph`, `countdown`, `fullscreen-color`, `animation`, `scoreboard`, `sync-time`,
  `reset`. See `docs/api-contract.md` for payloads.
- BLE is fire-and-forget: `sent` = wrote to radio, not rendered on screen.
- Uploads (image/gif) are processed server-side: re-encoded to 32×32 before upload.
- Config lives in `services/bridge/config.json` (gitignored; `config.example.json` is the
  template).
