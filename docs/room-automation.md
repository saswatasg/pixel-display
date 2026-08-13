# Room Automation Hub (Home Assistant on the Air)

Full plan + runbook for turning the always-on MacBook Air into the home
automation hub. Everything here runs without the MacBook Pro; the Pro is
only ever an optional place to edit this repo.

## Architecture

```
[Cloud]  pixel-display app (Vercel)          - unchanged, keeps working
[Air]    macOS, always-on, plugged in, 8 GB RAM
         ├─ pixel bridge  (127.0.0.1:8000, launchd)  - unchanged
         ├─ colima VM (or Docker Desktop) + launchd self-heal
         │    ├─ Home Assistant container  → 127.0.0.1:8123
         │    └─ Mosquitto MQTT            → 127.0.0.1:1883 (Qubo bridge)
         └─ Tailscale funnel
              ├─ "/"     → 8000  (pixel bridge, as today)
              └─ :8443   → 8123  (HA dashboard, from anywhere)
[Devices] Wiz (local UDP) · TCL Google TV (local) · Echo Dot (Alexa cloud)
          Panasonic AC (Comfort Cloud) · Ultrahuman Ring (API token)
          Qubo purifier HPH01 (MQTT bridge - Phase 2 spike) · Qubo cam (probe)
```

Runtime files live in `~/home-assistant` (out of iCloud Drive - macOS blocks
launchd agents from iCloud paths). The repo only holds templates.

## RAM budget (8 GB Air - do not exceed)

| Component          | ~RAM   |
|--------------------|--------|
| macOS + Chrome     | 3-4 GB |
| colima VM (2 CPU)  | 0.5-1 GB idle, 4 GB cap |
| Home Assistant     | <1.5 GB (capped) |
| Mosquitto          | <0.1 GB |
| pixel bridge       | ~0.3 GB |

No Frigate, no recording, no extra heavy containers on this host.

## Phase 0 - Foundation (shipped in repo)

- `services/hass/docker-compose.yml` - HA (capped 1.5 GB) + Mosquitto
- `services/hass/launchd/com.saswatas.homeassistant.plist.template` - same
  `open`-style self-heal as the pixel bridge (re-runs every 300s, no-op when
  healthy, recovers after crashes/wake)
- `services/hass/install.sh` - deploys to `~/home-assistant`, seeds
  `configuration.yaml` + mosquitto.conf, installs the launchd agent
- `services/hass/mosquitto.conf.example` - broker template

On the Air, from a terminal (no Pro involved):

```bash
# once: git clone https://github.com/saswatasg/pixel-display.git && cd pixel-display
# (or: cd ~/pixel-display && git pull)
brew install colima docker docker-compose
./services/hass/install.sh colima          # or: ./install.sh docker
"/Applications/Tailscale.app/Contents/MacOS/Tailscale" funnel --bg --yes --https=8443 http://127.0.0.1:8123
```

Then open `https://saswatas-macbook-air.taile61337.ts.net:8443`, finish HA
onboarding (it will ask location/name - set timezone Asia/Kolkata), and
install HACS (HACS.xyz instructions).

Verify: `docker-compose -f ~/home-assistant/docker-compose.yml ps` shows both
`Up`; `launchctl list | grep homeassistant` shows the job.

## Phase 1 - Local-first integrations (no cloud accounts)

1. **Philips Wiz bulb** - HA core `wiz` integration, Settings -> Devices ->
   Add. Local UDP discovery on the same Wi-Fi. Power/brightness/color/temp.
2. **TCL Google TV** - HA core `androidtv_remote`. On the TV enable
   Settings -> Network/Remote -> "Remote Control" once. HA discovers it on
   the LAN; power, volume, media, app launches.
3. **Pixel display as HA output** - bridge is on the same host, so HA can
   call it directly. Key lives in `~/pixel-display-bridge/config.json`.
   Put the key in `~/home-assistant/config/secrets.yaml` as
   `pixel_bridge_key: <key>` and add to `configuration.yaml`:

```yaml
rest_command:
  pixel_bridge_text:
    url: "http://127.0.0.1:8000/actions/text"
    method: POST
    headers:
      X-API-Key: !secret pixel_bridge_key
    content_type: "application/json"
    payload: '{"text": "{{ text | default(''HELLO'') }}", "brightness": {{ brightness | default(100) }}}'

sensor:
  - platform: rest
    name: Pixel Bridge Status
    resource: http://127.0.0.1:8000/status
    method: GET
    headers:
      X-API-Key: !secret pixel_bridge_key
    scan_interval: 30
    json_attributes_path: "$.device"
    json_attributes: ["connected", "address", "name"]
```

  Other bridge endpoints (same key header): `GET /status`, `GET
  /capabilities`, `POST /actions/{text|clock|weather|brightness|image|gif|media-add}`,
  `POST /devices/<deviceId>/actions/<action>`.

## Phase 2 - Cloud/account integrations

4. **Echo Dot** - HACS -> Alexa Media Player (`alexa_media_player`). Needs
   your Amazon India login + 2FA once. TTS announcements, media, volume.
5. **Panasonic AC** - HACS -> Comfort Cloud (`cc-panasonic`). Needs the
   Panasonic Smart App credentials. Power/temp/mode/fan/swing.
6. **Ultrahuman Ring** - generate a Personal API Token at
   `vision.ultrahuman.com/developer` -> Personal API Tokens -> RING DATA
   ACCESS, then HACS -> Ultrahuman (`tanujdargan/ultrahuman-ha`). Sleep,
   HR, HRV, temp, steps, glucose as sensors.
7. **Qubo purifier (HPH01) - SPIKE** - community bridge `hareeshmu/qubo-ha-mqtt`
   is proven on R700/HPH07; HPH01 likely needs adapter tweaks or traffic
   capture from the Qubo app (mitmproxy on the Air). Bridge process talks to
   Mosquitto on 127.0.0.1:1883 (add MQTT creds first, drop
   `allow_anonymous`). Outcome: power/fan/AQI in HA; worst case control stays
   in the Qubo app.
8. **Qubo camera - PROBE** - scan the LAN for RTSP/ONVIF (e.g.
   `nmap -p 554,8000,8899 <ip>`). If exposed: live view + snapshot +
   motion events in HA (no recording on this host). If cloud-only: stays in
   the Qubo app.

## Phase 3 - Dashboards & automations

Lovelace dashboards (phone + desktop) with cards for: lights, AC, TV,
purifier, AQI, ring health, camera, pixel status.

Starter suite:

- **Wake scene 07:30** - ring sleep data -> Wiz sunrise ramp, AC 24 C, Echo
  "Good morning", pixel display message
- **Wind-down 23:00** - Wiz warm dim, AC sleep mode, TV off if idle
- **AQI auto** - purifier high fan on bad air; AQI shown on the 32x32
- **Camera motion while away** - phone notify + Echo announce + pixel alert
- **Movie mode** - lights dim when TV streaming (scene fallback if no power
  state)
- **Ring anomalies** - HR/temp spikes -> Echo TTS

## Phase 4 - Ops

- **HA 2026 note:** the `http` integration (reverse proxies, ports) is
  store-managed since 2026.x - YAML `http:` is migrated once then ignored.
  Reverse-proxy settings live in `config/.storage/http` (`stable` slot). The
  funnel needs `use_x_forwarded_for: true` + `trusted_proxies:
  [172.16.0.0/12, 127.0.0.1, 100.64.0.0/10]` there (tailscaled proxies from
  the Docker bridge). Without it HA 400s every funnel request.
- **Restart stack:** `~/home-assistant/start.sh` (or launchd self-heals
  within 5 min)
- **Backup:** HA Settings -> System -> Backups -> create + download to the
  Air; config dir is `~/home-assistant/config` (tar it for offline copies)
- **Colima:** `colima stop` / `colima start`; Docker Desktop variant is just
  the app
- **Funnel:** `"/Applications/Tailscale.app/Contents/MacOS/Tailscale" funnel
  status` to list mappings, `funnel --bg --yes --https=8443 http://127.0.0.1:8123` to re-add
- **Update:** `docker-compose -f ~/home-assistant/docker-compose.yml pull &&
  up -d` (HA `stable` tag); the launchd agent stays untouched

## Risks

- Qubo HPH01 bridge needs reverse-engineering (spike in Phase 2; everything
  else proceeds regardless)
- Qubo camera may be cloud-only (stays in the Qubo app)
- `alexa_media` breaks occasionally on Amazon API changes (well-maintained)
- 8 GB RAM: no Frigate/recording; keep Chrome tabs sane on the Air
