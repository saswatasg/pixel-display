# Direct Bluetooth web controller

The web app exports static files and contains no bridge proxy or login routes.
The current device's browser owns the GATT connection to service
`000000fa-0000-1000-8000-00805f9b34fb`, characteristic
`0000fa02-0000-1000-8000-00805f9b34fb`. The service UUID is **00FA**, not FA00.

Pairing starts from a user click and filters the browser chooser by `IDM-` name.
Reconnect uses the selected device for this page session. Reloading asks the user
to select again. Explicit disconnect and radio disconnection stop browser programs.
Commands run in a bounded serial queue. Each command is tied to its connection
session; stale queued commands cannot run on a later connection. Partial write
failure disconnects rather than replaying an uncertain command. Writes use 20-byte
fragments for compatibility with the smallest BLE MTU. Bulk transfers prefer
ATT writes with response so each fragment waits for the panel. When a characteristic
only supports writes without response, fragments are paced 15 ms apart. Image mode
is given a 50 ms settling period before image bytes begin. This addresses a possible
cause of the reported black screen: an OS-queued burst does not guarantee that the
panel consumed the complete image. Actual rendering still requires hardware verification.

Text is rasterized into 16×32 one-bit glyphs with the bundled Rain font and packed
with settings and CRC32. Images are decoded and resized locally and encoded as
RGB PNG because the firmware mishandles RGBA. GIF disposal is composited before
32×32 palette encoding; frame count and decoded raster size are bounded.

Weather fetches Open-Meteo from the browser, renders the existing preview grid,
and uploads it over BLE. Slideshow photos are local data URLs. Only public weather
requests leave the device; display commands and uploaded media go directly to BLE.
Settings and small converted images are stored in localStorage under versioned keys.

## Physical-device acceptance checks

Run these in Chrome on macOS, Windows and Android over HTTPS (or localhost on the
same desktop computer). These checks require an actual display and are not replaced
by automated fake-GATT tests.

1. Stop the old bridge and disconnect the manufacturer app. Open the site on each
   device. Connect and select `IDM-…`. Verify the correct name and connected status.
2. Cancel the picker: the page should explain that no device was selected and allow
   another attempt. Try with the radio off and the panel out of range as well.
3. Set 5%, 50%, 100% brightness. Toggle power and flip. Verify on the panel.
4. Send single and multiple characters, spaces, colors, rainbow, background, static
   and scrolling text at each size. Compare legibility with the original app.
5. Send a transparent PNG/JPEG/WebP and confirm black compositing and correct RGB.
   Send an animated GIF with disposal changes; check scaling, frame order and timing.
6. Select clock styles, 12/24-hour mode and date; sync time and compare with the
   device controlling the display. Check effects, stopwatch, countdown and scores
   above 255 to validate two-byte score encoding.
7. Start a weather refresh and slideshow. Stop, switch to text, power off, and
   disconnect during an update. No later refresh should wake or overwrite the panel.
8. Disconnect during a long transfer; reconnect. The old transfer must not resume.
   Send a new image and confirm that it is complete.
9. Save settings, photos and presets; reload and play them. Open a second device
   and verify that its library is separate. Test storage denial/full storage errors.
10. Open on iOS, Safari or Firefox; pairing must be disabled with an explanation.
    Open a plain HTTP LAN URL; the page must explain the HTTPS requirement.
11. Verify network requests: no `/api/status`, `/api/action`, bridge, Tailscale,
    cloud media or login requests. Core controls work without internet after loading
    the page; loading/reloading still needs the static site and font assets.

Background refreshes are best-effort while the browser keeps the page running.
This version has no service worker/offline install cache, native iOS wrapper,
unattended schedules, wake program, stock quote provider, or cloud sync.

## Troubleshooting a black screen

Build `BLE-20261106-3` explicitly powers on the panel before content sends, exits
DIY mode before native modes, and uses ATT writes with response where available.
The app exposes **Test display — red**, which sends only brightness 50%, power on,
DIY off and fullscreen red commands; it bypasses uploads, font rendering and weather.
No stored display content is deleted or reset by this test.

Expand **Bluetooth diagnostics** to see the build, browser, connection capabilities,
outgoing packet prefixes and actual FA03 notifications if supported by the panel.
Copying diagnostics only copies local text to the clipboard; it does not upload it.
An ATT write response confirms the write at the Bluetooth layer, while notification
semantics vary by firmware; neither is treated as proof of visible output.

If the red test fails or flashes, collect its diagnostics before disconnecting so
the next investigation can distinguish missing device responses, rejected commands,
and later commands overriding a successful send. Verify the build marker after
refreshing: a stale browser tab continues to run its previously loaded code.
