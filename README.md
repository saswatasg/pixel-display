# Pixel Display Controller

Control an APEX / iDotMatrix **32×32** display directly from the Bluetooth radio
in the phone or computer viewing the website. No Tailscale, Python bridge,
API key, cloud storage account, or always-on Mac is needed.

```
Chrome on your phone or computer → Bluetooth Low Energy → nearby IDM display
```

## Run locally

```sh
cd apps/web
npm ci
npm run dev
```

Open `http://localhost:3000` in Chrome on that computer, click **Connect display**,
and choose the `IDM-…` device in the browser's Bluetooth picker. Keep the display
nearby and Bluetooth enabled. Disconnect the manufacturer app, other controllers,
and any previously running bridge if the display is occupied.

The site must use **HTTPS** when opened on another device. Plain HTTP at a LAN
IP address does not enable Web Bluetooth; localhost is the development exception.

## Deploy

This is a static Next.js export:

```sh
cd apps/web
npm run build
```

Serve `apps/web/out/` from any HTTPS static host. For Vercel use `apps/web` as the
project root, `npm run build` as the build command, and `out` as the output directory.
No environment variables or server functions are needed. Remove old bridge,
login and cloud-storage environment variables from previous deployments.

## Devices

- Chrome on macOS, Windows, and Android with Bluetooth Low Energy support.
- Safari, Firefox, and **all iPhone/iPad browsers including Chrome** are unsupported
  in this version. The interface explains this and disables pairing.
- Each browser asks for permission separately. Connect one controller at a time.
- Browser permissions can be revoked in site settings. “Choose another display”
  clears the current selection in the app; it does not revoke browser permissions.

## The redesigned workspace

A desktop workspace and a mobile remote share four destinations: **Display**, **Studio**,
**Library**, and **Device**. The interface follows the current device’s light/dark setting.
Desktop uses a persistent sidebar and side-by-side editors. Phones use bottom navigation,
compact previews, touch drawing, and pinned Save/Send controls.

The Studio includes text styling, image fitting/cropping, GIF uploads, and a 32×32 pixel
editor with keyboard support, undo/redo and starter artwork. The Library preserves existing
scenes and photos and adds favorites, search, rename, import/export and photo rotation.
Device settings contain pairing, optional screen wake lock, installation when supported,
and Bluetooth troubleshooting.

Product decisions, removed/redundant controls, responsive behavior and future bets:
[product and experience design](docs/product-design.md).

## Features

- Text and animation modes, custom/rainbow colors, background colors and font size.
- Images resized to RGB 32×32 PNG; GIFs resized and re-encoded in the browser.
- Clock styles, date/12/24-hour settings and time sync using the current device's time.
- Brightness, display power, animated effects, fullscreen color, flip, countdown,
  stopwatch and scoreboard.
- Scenes, settings, earlier images, and slideshow pictures saved **in this browser**.
  These do not sync across devices. Clearing site data removes them. Previously
  cloud-saved content is not automatically imported. Storage failures are surfaced.
- Weather (internet required) and photo-frame slideshows run while the page is open
  and connected. Background tabs, screen lock, or sleep can pause updates. Closing
  the page ends these programs; reconnecting does not silently restart them.
- Display-native modes such as clocks, effects and timers are handed to the panel.

Legacy daily schedules, morning wake and stock ticker are not available in this
web-only version. They depended on an always-on bridge, including its quote fetcher.
A website cannot promise unattended wake or scheduled Bluetooth writes while closed.
The UI states these limits instead of offering controls that call a missing server.

## Development and validation

```sh
cd apps/web
npm run typecheck
npm test
npm run build
```

Protocol vectors, PNG encoding, and fake-GATT lifecycle tests cover the browser
implementation. Real BLE interoperability still needs to be checked on the physical
32×32 display on each target platform; see [the manual checks](docs/direct-bluetooth.md).
“Sent” means all Bluetooth writes completed, not that the panel acknowledged rendering.

## Layout

- `apps/web/`: static browser app; `lib/bluetooth/` contains connection, packet encoding,
  font/image/GIF conversion and page-lifetime programs.
- `services/bridge/`, `services/hass/`: retained legacy integrations, not used by the web app.
- Other bridge API / automation documents in `docs/` describe those legacy services.

The protocol port is adapted from `idotmatrix` 0.0.9 (GPL-3.0); see
[third-party notices](apps/web/THIRD_PARTY_NOTICES.md). The bundled font retains its license.
