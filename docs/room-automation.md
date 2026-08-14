# Room Automation Hub (Home Assistant on the Air)

Full plan + runbook for turning the always-on MacBook Air into the home
automation hub. Everything here runs without the MacBook Pro; the Pro is
only ever an optional place to edit this repo.

## Architecture

```
[Cloud]  pixel-display app (Vercel)          - unchanged, keeps working
[Air]    macOS, always-on, plugged in, 8 GB RAM
         ├─ pixel bridge  (127.0.0.1:8000, launchd)  - unchanged
         ├─ colima VM (vmnet shared: 192.168.64.2, reachable from host) + launchd self-heal
         │    ├─ Home Assistant container (host networking)  → 192.168.64.2:8123
         │    └─ Mosquitto MQTT            (host networking) → 192.168.64.2:1883
         ├─ ha-tunnel (launchd): colima ssh -L 127.0.0.1:8123 -> VM 8123
         └─ Tailscale funnel
              ├─ "/"     → 127.0.0.1:8000  (pixel bridge, as today)
              └─ :8443   → 127.0.0.1:8123  (HA dashboard, from anywhere)
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
```

### Network model (why the VM needs --network-address)

HA inside colima runs behind the VM's NAT by default: the container only sees
the Docker bridge (172.17/172.18.x), so host networking is needed for both
containers + `colima start --network-address`. That puts the VM on a
**vmnet host-shared** network (192.168.64.0/24, host side 192.168.64.1) -
NOT bridged onto the home LAN:

- Reachable from the host (tailscaled -> funnel -> 192.168.64.2:8123) 
- Outbound unicast TCP/UDP to LAN devices/NAT works (manual-IP setups)
- Broadcast discovery (WiZ UDP broadcast, mDNS/SSDP) does NOT cross the NAT
  -> add every LAN device by IP, never rely on discovery.

```bash
colima stop && colima delete -f
colima start --network-address --cpu 2 --memory 4   # first time prompts sudo
colima ssh -- hostname -I        # 192.168.64.2 = the vmnet shared address
# (the 192.168.5.x/172.x entries are internal - ignore)
# funnel ONLY proxies to loopback -> expose the VM's HA port via SSH tunnel,
# installed as a launchd agent (com.saswatas.ha-tunnel) by install.sh:
colima ssh -- -N -L 8123:localhost:8123 \
    -o ExitOnForwardFailure=yes -o ServerAliveInterval=30
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8123/   # 200/302
"/Applications/Tailscale.app/Contents/MacOS/Tailscale" funnel --https=8443 off
"/Applications/Tailscale.app/Contents/MacOS/Tailscale" funnel --bg --yes --https=8443 http://127.0.0.1:8123
docker-compose -f ~/home-assistant/docker-compose.yml up -d   # recreates with host networking
```

`trusted_proxies` in `config/.storage/http` must include the vmnet subnet
(`192.168.64.0/24`) - tailscaled proxies from the host's vmnet address
(192.168.64.1). MQTT integration in HA points at `127.0.0.1:1883` now
(containers share the VM's network stack), not `host.docker.internal`.
Reserve the LAN devices' IPs (bulb, TV, camera) in the router instead - HA
talks to them by IP.

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
3. **Pixel display as HA output** - the bridge runs on the Air's loopback
   (`127.0.0.1:8000`), which the HA container cannot reach directly.
   Simplest robust path: call it through the public funnel (same key, no
   extra exposure). The ready-made block lives in
   `services/hass/phase1-example.yaml` (`rest_command` + status `sensor`);
   append it to `configuration.yaml` and put the bridge key
   (`~/pixel-display-bridge/config.json`) into `config/secrets.yaml` as
   `pixel_bridge_key`. Other bridge endpoints (same key header):
   `GET /status`, `GET /capabilities`,
   `POST /actions/{text|clock|weather|brightness|image|gif|media-add}`,
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
  [192.168.64.0/24, 172.16.0.0/12, 127.0.0.1, 100.64.0.0/10]` there
  (tailscaled proxies from the host's vmnet address). Without it HA 400s
  every funnel request.
- **Restart stack:** `~/home-assistant/start.sh` (or launchd self-heals
  within 5 min)
- **Backup:** HA Settings -> System -> Backups -> create + download to the
  Air; config dir is `~/home-assistant/config` (tar it for offline copies)
- **Colima:** `colima stop` / `colima start` (start.sh adds
  `--network-address`); VM address: `colima ssh -- hostname -I` (expect
  192.168.64.2; internal 192.168.5.x / 172.x entries are normal). The vmnet
  address is stable per profile - the funnel mapping survives reboots
- **Funnel:** `"/Applications/Tailscale.app/Contents/MacOS/Tailscale" funnel
  status` to list mappings; funnel only proxies to loopback, so after a VM
  rebuild make sure the ha-tunnel site is up, then
  `funnel --https=8443 off` + `funnel --bg --yes --https=8443 http://127.0.0.1:8123`
- **ha-tunnel:** `launchctl list | grep ha-tunnel`; logs in
  `~/home-assistant/logs/ha-tunnel.*` (KeepAlive restarts it on exit)
- **Update:** `docker-compose -f ~/home-assistant/docker-compose.yml pull &&
  up -d` (HA `stable` tag); the launchd agent stays untouched

## Risks

- Qubo HPH01 bridge needs reverse-engineering (spike in Phase 2; everything
  else proceeds regardless)
- Qubo camera may be cloud-only (stays in the Qubo app)
- `alexa_media` breaks occasionally on Amazon API changes (well-maintained)
- 8 GB RAM: no Frigate/recording; keep Chrome tabs sane on the Air
