# Pixel Display — product and experience design

## Product direction

A personal remote and a small creative studio, with equal importance. The user
confirmed this balance and requested appearance that follows the device’s light/dark
setting. This replaces the previous narrow, vertically stacked controller.

The core job: make a nearby display useful or expressive, then return to a saved
scene with very little effort. Editing and saving do not require a Bluetooth
connection. Sending always does, and remains an explicit action.

## Desktop and mobile are different working environments

| Area | Desktop | Mobile |
| --- | --- | --- |
| Navigation | Persistent left sidebar; a top connection toolbar | Four bottom destinations; compact sticky header |
| Display | Wide overview with artwork and controls side by side | Compact remote with preview, power, brightness and thumb-access navigation |
| Studio | Canvas and properties inspector visible together; bottom action row | Compact message preview above the editor; large touch canvas for drawing; fixed Save/Send row above navigation |
| Library | Multi-column visual collection, search and filters | Two-column cards and touch-friendly actions |
| Settings | Parallel connection, appearance and support panels | Sequential full-width panels |
| Input | Mouse, pen and keyboard; Cmd/Ctrl+Enter to send from Studio | Finger drawing, native selects and large primary buttons |
| Layout | Full-height workspace with its own content scroll area | Natural document scrolling and safe-area-aware fixed navigation |

The tablet breakpoint retains the workspace with an icon rail and accessible navigation labels. Narrow screens use
mobile navigation. There is no horizontal scrolling at 320 px or wider in the main
screen checks. Device appearance is the default, with Light/Dark overrides available.

## Information architecture

- **Display**: last content sent from this browser, explicit On/Off controls,
  brightness, shortcuts into creation, native modes, running programs, and favorites.
- **Studio**: messages, image/GIF preparation, and a 32×32 pixel editor.
- **Library**: saved scenes, favorites, search, rename, photo rotation, and backup.
- **Device**: connect/disconnect/switch display, appearance, screen wake lock,
  installation when the browser offers it, and connection troubleshooting.

## Feature decisions

| Feature | Decision | Reason |
| --- | --- | --- |
| Clock, weather, text, image/GIF and effects | Keep and redesign | These make the display useful every day |
| Power and brightness | Keep prominent | Essential remote controls; explicit On and Off avoid guessing physical state |
| Timer, stopwatch and scoreboard | Keep within mode selection | Useful occasionally, with less prominence than core creation |
| Pixel editor | Add | Makes the product a creative tool; supports pointer drawing, keyboard painting, erase, grid, undo/redo and starter artwork |
| Image fitting and crop position | Add | Shows the actual 32×32 composition before sending |
| Draft retention | Add | Text settings and pixel artwork survive navigation and refresh |
| Favorites, search and rename | Add/consolidate | Makes a growing scene library manageable |
| Library export/import | Add | Makes browser-local ownership practical across devices without accounts |
| Photo slideshow | Keep in Library | A photo rotation belongs with its images; supports four images, shuffle and interval |
| Screen wake lock | Add where supported | Helps the browser stay available for weather and slideshows; permission or battery limits may release it |
| Desktop/Android app installation | Add browser manifest and conditional install prompt | Offers a standalone window while retaining the web Bluetooth implementation |
| Always-visible diagnostics and red test | Move into Device | Valuable recovery tools, unnecessary visual weight in everyday use |
| Fake “live display” clock | Remove | It implied that the app could read the physical framebuffer |
| Separate image-history and saved-image destinations | Consolidate | Previous images remain available in Library and can become scenes |
| Duplicated power controls and “stop everything” language | Consolidate | One consistent remote and a clearly named Stop updates action |
| Cloud-storage language and account/login setup | Remove | The app uses the current browser’s storage and Bluetooth |
| Daily schedules, morning wake, stock ticker | Exclude from this web-only product | The former implementation depended on an always-on bridge and quote fetcher |
| iPhone wrapper and multi-device cloud synchronization | Defer | Separately scoped products, not implied by this web redesign |

## Trust and interaction rules

1. A preview is a preview. Native clock/effect previews are illustrative; images
   show their crop and pixel resolution. The dashboard is explicitly labelled as
   last sent from this browser, not a live feed of the hardware.
2. Connecting does not send or erase content. Sending preserves the now-working
   Bluetooth preparation sequence and transport.
3. Controls requiring hardware are disabled until connected. Creation, editing,
   saving, search and export work without a paired display.
4. A single send is active at a time. Brightness is committed when the slider is
   released or adjusted with keyboard keys, avoiding a stream of radio writes.
5. Previously saved scenes and images keep their existing storage keys. The new
   design does not clear or migrate away the existing library.
6. Imports validate the file, merge scenes, regenerate imported IDs, avoid duplicate
   content, preserve the current library and roll back writes on storage failure.
   Library backups include scenes and photos, not Bluetooth permissions or app
   appearance. Slideshow/history retain their four/24-image limits.
7. Delete requires an explicit confirmation. A failed save keeps the dialog open
   with an error; connection and storage failures are surfaced in context.
8. Browser-owned dialogs provide pairing and permission consent. Location is only
   requested after the user chooses Use my location; manual city search is available.

## Accessibility and ergonomics

Native labelled form controls, visible focus rings, keyboard-accessible actions,
modal focus containment, reduced-motion support and safe-area padding are included.
The pixel canvas has arrow-key navigation, Space to paint and Delete to erase.
Small form fields use 16 px text on mobile to avoid browser zoom. Primary touch
controls are 44–46 px or larger; compact swatches and utility actions are about
40–42 px. Light-theme muted text was adjusted for contrast on the tinted surfaces.
This is not a claim of a complete WCAG conformance audit.

## Verification and remaining limits

Protocol, connection lifecycle, power/mode preparation, image transfer, local storage
and backup validation have automated coverage. The production build is checked in
Chrome at desktop, narrow-phone and regular-phone sizes; saving art, favorites,
slideshow selection, keyboard drawing, navigation and theme overrides are exercised.
The existing hardware protocol was previously confirmed working by the user and is
preserved; this redesign does not claim a new cross-platform physical-device test.

Weather and photo rotations need an open, connected page. A wake lock does not
create reliable background scheduling. Installation does not add iOS Bluetooth
support or guaranteed offline reloading; there is no service-worker cache yet.
GIF preview is the first frame; the full resized animation is sent. GIF scene
saving and animation editing remain future work.

## Next product bets

- Better animation authoring and saved GIF scenes, after storage limits are designed.
- Offline shell caching and a tested update flow for installed browser apps.
- A native Bluetooth wrapper for iPhone, sharing the web interface.
- Optional opt-in synchronization only if maintaining a collection across devices
  proves more valuable than the current account-free local model.

Success should first be judged by time to first visible output, successful send
rate, recovery from disconnection, and how quickly a saved scene can be replayed.
No analytics collection or account system is added by this redesign.
