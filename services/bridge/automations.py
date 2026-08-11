"""Automations for the pixel display bridge: weather, stocks, slideshow, scenes.

The scheduler owns ONE active program at a time:
  - an explicit program (weather / stocks / slideshow), or
  - a time-of-day playlist of programs (scenes),
and re-renders it on its own interval. State persists to
`automation.json` next to the bridge so scheduled programs resume
after a restart.

Data sources are free and keyless:
  - weather: Open-Meteo (https://open-meteo.com)
  - stocks:  Yahoo Finance public chart endpoint
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import math
import random
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable

from PIL import Image, ImageDraw

log = logging.getLogger("pixelbridge.automation")

# Sunrise wake timezone: IST (UTC+5:30), hardcoded so the 8 AM wake works on
# any machine timezone and without any tz database installed.
IST = timezone(timedelta(hours=5, minutes=30))

WAKE_DEFAULT: dict[str, Any] = {
    "enabled": True,
    "time": "08:00",
    "program": "clock",
    "config": {},
    "lastWake": None,
}

# --------------------------------------------------------------------- fonts

# 5x7 bitmap font shared with the web preview (components/LiveClock.tsx)
FONT_5X7: dict[str, list[str]] = {
    "0": [".###.", "#...#", "#..#.", "#.#.#", "#...#", "#...#", ".###."],
    "1": [".#...", "##...", ".#...", ".#...", ".#...", ".#...", "###.."],
    "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
    "3": ["#####", "....#", "...#.", "..#..", "....#", "#...#", ".###."],
    "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
    "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
    "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
    "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
    "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
    "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
    "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
}

# 3x5 uppercase font for compact labels (weather city), pitch 4px including gap
FONT_3X5: dict[str, list[str]] = {
    "A": ["###", "#.#", "###", "#.#", "#.#"],
    "B": ["##.", "#.#", "##.", "#.#", "##."],
    "C": ["###", "#..", "#..", "#..", "###"],
    "D": ["##.", "#.#", "#.#", "#.#", "##."],
    "E": ["###", "#..", "###", "#..", "###"],
    "F": ["###", "#..", "###", "#..", "#.."],
    "G": ["###", "#..", "#.#", "#.#", "###"],
    "H": ["#.#", "#.#", "###", "#.#", "#.#"],
    "I": ["###", ".#.", ".#.", ".#.", "###"],
    "J": ["..#", "..#", "..#", "#.#", "###"],
    "K": ["#.#", "##.", "#.#", "##.", "#.#"],
    "L": ["#..", "#..", "#..", "#..", "###"],
    "M": ["#.#", "###", "###", "#.#", "#.#"],
    "N": ["#.#", "###", "###", "###", "#.#"],
    "O": ["###", "#.#", "#.#", "#.#", "###"],
    "P": ["##.", "#.#", "##.", "#..", "#.."],
    "Q": ["###", "#.#", "#.#", "##.", "#.#"],
    "R": ["##.", "#.#", "##.", "#.#", "#.#"],
    "S": ["###", "#..", "###", "..#", "###"],
    "T": ["###", ".#.", ".#.", ".#.", ".#."],
    "U": ["#.#", "#.#", "#.#", "#.#", "###"],
    "V": ["#.#", "#.#", "#.#", "#.#", ".#."],
    "W": ["#.#", "#.#", "###", "###", "#.#"],
    "X": ["#.#", "#.#", ".#.", "#.#", "#.#"],
    "Y": ["#.#", "#.#", ".#.", ".#.", ".#."],
    "Z": ["###", "..#", ".#.", "#..", "###"],
    "0": ["###", "#.#", "#.#", "#.#", "###"],
    "1": [".#.", "##.", ".#.", ".#.", "###"],
    "2": ["###", "..#", "###", "#..", "###"],
    "3": ["###", "..#", "###", "..#", "###"],
    "4": ["#.#", "#.#", "###", "..#", "..#"],
    "5": ["###", "#..", "###", "..#", "###"],
    "6": ["###", "#..", "###", "#.#", "###"],
    "7": ["###", "..#", "..#", "..#", "..#"],
    "8": ["###", "#.#", "###", "#.#", "###"],
    "9": ["###", "#.#", "###", "..#", "###"],
    "-": ["...", "...", "###", "...", "..."],
    ".": ["...", "...", "...", "...", ".#."],
}


# ------------------------------------------------------------------ fetchers


def _http_json(url: str, timeout: float = 12.0) -> dict[str, Any]:
    req = urllib.request.Request(url, headers={"User-Agent": "pixel-display-bridge/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
        return json.loads(resp.read().decode("utf-8"))


def _http_bytes(url: str, timeout: float = 20.0) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "pixel-display-bridge/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
        return resp.read()


async def fetch_weather(lat: float, lon: float, unit: str = "c") -> dict[str, Any]:
    """Current conditions from Open-Meteo."""
    params = urllib.parse.urlencode(
        {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,apparent_temperature,relative_humidity_2m,"
            "weather_code,wind_speed_10m,is_day",
            "timezone": "auto",
            "temperature_unit": "celsius" if unit == "c" else "fahrenheit",
        }
    )
    data = await asyncio.to_thread(_http_json, f"https://api.open-meteo.com/v1/forecast?{params}")
    cur = data.get("current", {})
    return {
        "temperature": cur.get("temperature_2m"),
        "feels_like": cur.get("apparent_temperature"),
        "humidity": cur.get("relative_humidity_2m"),
        "weather_code": cur.get("weather_code"),
        "wind_speed": cur.get("wind_speed_10m"),
        "is_day": bool(cur.get("is_day")),
        "unit": unit,
    }


async def fetch_quotes(symbols: list[str]) -> list[dict[str, Any]]:
    """Price + day change from Yahoo Finance's public chart endpoint."""
    quotes: list[dict[str, Any]] = []
    for symbol in symbols[:12]:
        try:
            url = (
                "https://query1.finance.yahoo.com/v8/finance/chart/"
                + urllib.parse.quote(symbol)
                + "?range=1d&interval=1d"
            )
            data = await asyncio.to_thread(_http_json, url)
            result = data.get("chart", {}).get("result") or []
            if not result:
                raise ValueError("empty result")
            meta = result[0].get("meta", {})
            price = meta.get("regularMarketPrice")
            prev = meta.get("chartPreviousClose") or meta.get("previousClose")
            if price is None:
                raise ValueError("no price")
            change = ((price - prev) / prev * 100) if prev else 0.0
            quotes.append(
                {
                    "symbol": symbol.upper(),
                    "price": round(float(price), 2),
                    "change": round(change, 1),
                    "ok": True,
                }
            )
        except Exception as exc:  # noqa: BLE001
            quotes.append({"symbol": symbol.upper(), "ok": False, "error": str(exc)[:80]})
        await asyncio.sleep(0.2)
    return quotes


# ---------------------------------------------------------------- weather art


def _draw_sun(d: ImageDraw.ImageDraw, cx: int, cy: int, r: int, color: tuple[int, int, int]) -> None:
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color)
    for i in range(8):
        ang = math.pi / 4 * i
        x1 = cx + int(math.cos(ang) * (r + 1)) - 1
        y1 = cy + int(math.sin(ang) * (r + 1)) - 1
        x2 = cx + int(math.cos(ang) * (r + 3)) + 1
        y2 = cy + int(math.sin(ang) * (r + 3)) + 1
        d.rectangle((x1, y1, x2, y2), fill=color)


def _draw_moon(d: ImageDraw.ImageDraw, cx: int, cy: int, r: int, color: tuple[int, int, int], bg: tuple[int, int, int]) -> None:
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color)
    d.ellipse((cx + r // 2, cy - r, cx + r + r // 2, cy + r), fill=bg)


def _draw_cloud(d: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, color: tuple[int, int, int]) -> None:
    d.rounded_rectangle((x, y + h // 2, x + w, y + h), radius=3, fill=color)
    d.ellipse((x + w // 4, y, x + w // 4 + h, y + h), fill=color)
    d.ellipse((x + w // 2, y + h // 4, x + w // 2 + h, y + h + h // 4), fill=color)


def _draw_bolt(d: ImageDraw.ImageDraw, x: int, y: int, color: tuple[int, int, int]) -> None:
    d.polygon(
        [(x, y), (x - 2, y + 4), (x, y + 4), (x - 1, y + 7), (x + 2, y + 2), (x, y + 2)],
        fill=color,
    )


def _weather_icon_image(code: int, is_day: bool) -> Image.Image:
    """32x32 icon for a WMO weather code, drawn in the middle band (rows 6-19)."""
    bg = (0, 0, 0, 0)
    sun_c = (255, 211, 77)
    moon_c = (228, 233, 246)
    cloud_c = (185, 196, 206)
    rain_c = (111, 183, 255)
    snow_c = (255, 255, 255)
    bolt_c = (255, 211, 77)

    icon = Image.new("RGBA", (32, 32), bg)
    d = ImageDraw.Draw(icon)

    partly = code in (1, 2)
    cloudy = code == 3 or code in (80, 81, 82)
    foggy = code in (45, 48)
    rainy = code in (51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80)
    heavy = code in (82, 95, 96, 99)
    snowy = code in (71, 73, 75, 77, 85, 86)
    stormy = code in (95, 96, 99)

    if code == 0 or (partly and is_day):
        _draw_sun(d, 16, 12, 4, sun_c)
    elif code == 0:
        _draw_moon(d, 16, 12, 4, moon_c, bg)
    elif partly and not is_day:
        _draw_moon(d, 10, 9, 3, moon_c, bg)
        _draw_cloud(d, 9, 10, 16, 7, cloud_c)
    elif partly:
        _draw_sun(d, 10, 8, 3, sun_c)
        _draw_cloud(d, 10, 9, 16, 7, cloud_c)

    if cloudy:
        _draw_cloud(d, 7, 10, 18, 7, cloud_c)
    if foggy:
        _draw_cloud(d, 7, 7, 18, 7, cloud_c)
        for i, y in enumerate((15, 17, 19)):
            d.rounded_rectangle((6 + i * 2, y, 26 - i, y + 2), radius=1, fill=cloud_c)
    if rainy or heavy:
        for i, x in enumerate((8, 14, 20)):
            d.line((x, 17 + i % 2, x - 2, 21 - i % 2), fill=rain_c, width=2)
    if snowy:
        for x, y in ((9, 18), (16, 16), (22, 18)):
            d.rectangle((x - 1, y - 1, x + 1, y + 1), fill=snow_c)
            d.line((x - 3, y, x + 3, y), fill=snow_c)
            d.line((x, y - 3, x, y + 3), fill=snow_c)
    if stormy:
        _draw_bolt(d, 22, 14, bolt_c)
    return icon


# ---------------------------------------------------------------- rendering


def _draw_text_3x5(d: ImageDraw.ImageDraw, text: str, x: int, y: int, color: tuple[int, int, int]) -> None:
    """Draw uppercase text with the 3x5 font (pitch 4px)."""
    for ch in text.upper():
        glyph = FONT_3X5.get(ch)
        if glyph:
            for r in range(5):
                for c in range(3):
                    if glyph[r][c] == "#":
                        d.rectangle((x + c, y + r, x + c, y + r), fill=color)
        x += 4


def render_weather_png(
    weather: dict[str, Any],
    accent: tuple[int, int, int] = (255, 255, 255),
    city: str = "",
) -> bytes:
    """Compose a 32x32 RGB weather card: city on top, icon in the middle band,
    temperature at the bottom.

    NOTE: must be plain RGB (no alpha channel) - the device firmware's PNG
    decoder garbles RGBA images into scattered pixels.
    """
    img = Image.new("RGB", (32, 32), (0, 0, 0))
    d = ImageDraw.Draw(img)

    code = int(weather.get("weather_code") or 0)
    is_day = bool(weather.get("is_day"))
    icon = _weather_icon_image(code, is_day)
    img.paste(icon, (0, 0), icon)

    label = "".join(ch for ch in city.upper() if ch.isalnum() or ch in "-.") or "NOW"
    label = label[:8]
    _draw_text_3x5(d, label, (32 - len(label) * 4) // 2, 0, accent)

    temp = weather.get("temperature")
    deg = "" if temp is None else f"{round(float(temp))}\u00b0"
    if not deg:
        deg = "--\u00b0"
    pitch = 6
    total_w = pitch * len(deg)
    x = (32 - total_w) // 2
    y = 22
    for ch in deg:
        if ch == "\u00b0":
            d.rectangle((x + 2, y, x + 3, y + 1), fill=accent)
        else:
            glyph = FONT_5X7.get(ch)
            if glyph:
                for r in range(7):
                    for c in range(5):
                        if glyph[r][c] == "#":
                            d.rectangle((x + c, y + r, x + c, y + r), fill=accent)
        x += pitch
    buf = __import__("io").BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ----------------------------------------------------------------- scheduler


class Automation:
    """Runs the active program on an interval; persists across restarts."""

    TICK_SEC = 10

    def __init__(self, state_path: Path, runner: Callable[[str, dict[str, Any]], Awaitable[dict[str, Any]]]) -> None:
        self.state_path = Path(state_path)
        self.runner = runner
        self.enabled = False
        self.explicit: dict[str, Any] | None = None
        self.playlist: list[dict[str, Any]] = []
        self._current: dict[str, Any] | None = None
        self.status: dict[str, Any] = {
            "enabled": False,
            "program": None,
            "lastRunAt": None,
            "nextRunAt": None,
            "lastResult": None,
            "error": None,
        }
        self._task: asyncio.Task | None = None
        self._stopping = False
        self._stock_cache: dict[str, Any] = {"key": None, "quotes": [], "fetched": 0.0, "idx": 0}
        self.wake: dict[str, Any] = dict(WAKE_DEFAULT)
        self.status["wake"] = {k: v for k, v in self.wake.items() if k != "lastWake"}

    # ------------------------------------------------------------- lifecycle

    async def start(self) -> None:
        await self._load()
        self._task = asyncio.create_task(self._loop(), name="automation")

    async def stop(self) -> None:
        self._stopping = True
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _save(self) -> None:
        data = {
            "enabled": self.enabled,
            "explicit": self.explicit,
            "playlist": self.playlist,
            "wake": self.wake,
        }
        try:
            self.state_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        except Exception as exc:  # noqa: BLE001
            log.warning("failed to persist automation state: %s", exc)

    async def _load(self) -> None:
        try:
            if not self.state_path.exists():
                return
            data = json.loads(self.state_path.read_text(encoding="utf-8"))
            self.enabled = bool(data.get("enabled", False))
            self.explicit = data.get("explicit")
            self.playlist = data.get("playlist") or []
            wake = data.get("wake")
            if isinstance(wake, dict):
                self.wake.update({k: v for k, v in wake.items() if k in WAKE_DEFAULT})
            self._sync_wake_status()
            self.status["enabled"] = self.enabled
            log.info("automation resumed: enabled=%s explicit=%s playlist=%d entries", self.enabled, bool(self.explicit), len(self.playlist))
        except Exception as exc:  # noqa: BLE001
            log.warning("failed to load automation state: %s", exc)

    def _sync_wake_status(self) -> None:
        self.status["wake"] = {k: v for k, v in self.wake.items() if k != "lastWake"}

    # -------------------------------------------------------------- controls

    def set_explicit(self, program: dict[str, Any], enabled: bool = True) -> None:
        self.explicit = program
        self.playlist = []
        self.enabled = enabled
        self.status["enabled"] = enabled
        self._reset_caches()
        asyncio.get_running_loop().create_task(self._save())
        log.info("automation: explicit program %s", program.get("type"))

    def set_playlist(self, playlist: list[dict[str, Any]], enabled: bool = True) -> None:
        self.explicit = None
        self.playlist = playlist
        self.enabled = enabled
        self.status["enabled"] = enabled
        self._reset_caches()
        asyncio.get_running_loop().create_task(self._save())
        log.info("automation: playlist with %d entries", len(playlist))

    def set_enabled(self, enabled: bool) -> None:
        self.enabled = enabled
        self.status["enabled"] = enabled
        asyncio.get_running_loop().create_task(self._save())

    def _reset_caches(self) -> None:
        self._stock_cache = {"key": None, "quotes": [], "fetched": 0.0, "idx": 0}

    def disable(self) -> None:
        self.enabled = False
        self.explicit = None
        self.playlist = []
        self._current = None
        self.status["enabled"] = False
        self.status["program"] = None
        asyncio.get_running_loop().create_task(self._save())

    # ----------------------------------------------------------- daily wake

    def set_wake(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Configure the daily wake (8 AM IST by default): turns the display
        back on and starts the wake program, even with the app/network down —
        the bridge loop is local (BLE only)."""
        if "enabled" in payload:
            self.wake["enabled"] = bool(payload["enabled"])
        if "time" in payload:
            new_time = str(payload["time"]).strip()
            if len(new_time) == 5 and new_time[2] == ":" and all(
                c.isdigit() for c in new_time.split(":")
            ):
                hh, mm = (int(x) for x in new_time.split(":"))
                if hh in range(24) and mm in range(60):
                    self.wake["time"] = new_time
        if "program" in payload:
            program = str(payload["program"]).strip().lower()
            if program in ("clock", "image"):
                self.wake["program"] = program
        if isinstance(payload.get("config"), dict):
            self.wake["config"] = payload["config"]
        self._sync_wake_status()
        asyncio.get_running_loop().create_task(self._save())
        log.info("wake configured: %s", {k: v for k, v in self.wake.items() if k != "lastWake"})
        return {"ok": True, "wake": dict(self.status["wake"])}

    async def _check_wake(self) -> None:
        if not self.wake.get("enabled"):
            return
        try:
            now = datetime.now(IST)
            hh, mm = (int(x) for x in str(self.wake.get("time", "08:00")).split(":"))
            target = now.replace(hour=hh, minute=mm, second=0, microsecond=0)
            today = now.strftime("%Y-%m-%d")
            if now < target or self.wake.get("lastWake") == today:
                return
            log.info("wake firing at %s IST - powering display on", now.strftime("%H:%M"))
            await self.runner("screen", {"power": "on"})
            program = self._wake_program()
            if program is None:
                log.warning("wake image program fell back to clock (empty photo frame)")
                program = {"type": "clock", "config": {"style": 0, "color": "#FFFFFF", "showDate": True, "format24h": True}}
            self.set_explicit(program, enabled=True)
            await self.run_now()
            self.wake["lastWake"] = today
            asyncio.create_task(self._save())
        except Exception as exc:  # noqa: BLE001
            log.warning("wake check failed: %s", exc)

    def _wake_program(self) -> dict[str, Any] | None:
        if self.wake.get("program") != "image":
            return {
                "type": "clock",
                "config": {
                    "style": int(self.wake.get("config", {}).get("style", 0)),
                    "color": str(self.wake.get("config", {}).get("color", "#FFFFFF")),
                    "showDate": True,
                    "format24h": True,
                },
            }
        media = self.list_media()
        if not media:
            return None
        return {"type": "slideshow", "config": {"interval": 60, "shuffle": False, "index": 0}}

    async def run_now(self) -> dict[str, Any]:
        program = self._resolve()
        if not program:
            self.status["error"] = "no active program"
            return {"ok": False, "error": "no active program"}
        self.status["program"] = program.get("type")
        try:
            result = await self._execute_program(program)
            self.status["lastRunAt"] = time.time()
            self.status["nextRunAt"] = time.time() + self._interval(program)
            self.status["lastResult"] = "ok"
            self.status["error"] = None
            return {"ok": result.get("ok", True), **{k: v for k, v in result.items() if k != "ok"}}
        except Exception as exc:  # noqa: BLE001
            self.status["lastResult"] = "error"
            self.status["error"] = str(exc)
            log.warning("automation run failed (%s): %s", program.get("type"), exc)
            return {"ok": False, "error": str(exc)}

    async def advance_slideshow(self) -> None:
        """Explicitly move to the next media item."""
        if self.explicit and self.explicit.get("type") == "slideshow":
            cfg = self.explicit.setdefault("config", {})
            cfg["index"] = (int(cfg.get("index", 0)) + 1) % max(1, len(self.list_media()))
        await self.run_now()

    def _resolve(self) -> dict[str, Any] | None:
        if not self.enabled:
            return None
        if self.playlist:
            now = time.strftime("%H:%M")
            minute_of_day = int(now[:2]) * 60 + int(now[3:5])
            for entry in self.playlist:
                start, end = entry.get("start"), entry.get("end")
                if not start or not end or ":" not in start or ":" not in end:
                    continue
                s = int(start[:2]) * 60 + int(start[3:5])
                e = int(end[:2]) * 60 + int(end[3:5])
                wraps = s > e
                inside = (minute_of_day >= s and minute_of_day < e) if not wraps else (
                    minute_of_day >= s or minute_of_day < e
                )
                if inside:
                    return {"type": entry.get("program", "clock"), "config": entry.get("config") or {}}
            return None
        return self.explicit

    def _interval(self, program: dict[str, Any]) -> int:
        cfg = program.get("config") or {}
        kind = program.get("type")
        if kind == "weather":
            return max(60, int(cfg.get("interval", 30)) * 60)
        if kind == "stocks":
            # Rotate one symbol at a time; hold long enough for the FULL line
            # (symbol + change) to scroll across the 32px window before the
            # next symbol replaces it. Sized off the longest quote and the
            # configured scroll speed so names never get cut off.
            cache = self._stock_cache
            longest = 22
            if cache.get("quotes"):
                longest = max(len(q.get("symbol", "")) + 10 for q in cache["quotes"])
            speed = max(1, min(255, int(cfg.get("speed", 80))))
            px_per_s = speed * 30 / 80
            return max(8, int((longest * 16 + 32) / px_per_s) + 4)
        if kind == "slideshow":
            return max(5, int(cfg.get("interval", 20)))
        if kind == "clock":
            return 300
        if kind == "effect":
            return 300
        return max(30, int(cfg.get("interval", 300)))

    # ------------------------------------------------------------------ loop

    async def _loop(self) -> None:
        while not self._stopping:
            try:
                await self._tick()
                await self._check_wake()
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001
                log.warning("automation tick failed: %s", exc)
            await asyncio.sleep(self.TICK_SEC)

    async def _tick(self) -> None:
        program = self._resolve()
        if not program:
            self._current = None
            self.status["program"] = None
            self.status["nextRunAt"] = None
            return
        kind = program.get("type")
        current = self._current or {}
        same = current.get("type") == kind and json.dumps(current.get("config", {}), sort_keys=True) == json.dumps(
            program.get("config", {}), sort_keys=True
        )
        due = (self.status.get("nextRunAt") or 0) <= time.time()
        if not same or due:
            self._current = program
            self.status["program"] = kind
            await self.run_now()
            self.status["nextRunAt"] = time.time() + self._interval(program)

    # ----------------------------------------------------------- program exec

    async def _execute_program(self, program: dict[str, Any]) -> dict[str, Any]:
        kind = program.get("type")
        cfg = program.get("config") or {}
        if kind == "weather":
            lat = float(cfg["lat"])
            lon = float(cfg["lon"])
            unit = "f" if cfg.get("unit") == "f" else "c"
            weather = await fetch_weather(lat, lon, unit)
            accent = _hex_to_rgb(str(cfg.get("color", "#FFFFFF")))
            city = str(cfg.get("name", "")).strip()
            png = await asyncio.to_thread(render_weather_png, weather, accent, city)
            b64 = base64.b64encode(png).decode()
            return await self.runner("image", {"image_base64": b64, "_automation": kind})
        if kind == "stocks":
            symbols = [str(s).strip().upper() for s in cfg.get("symbols", []) if str(s).strip()][:4]
            if not symbols:
                raise ValueError("no symbols")
            refresh_every = max(1, int(cfg.get("interval", 10))) * 60
            key = json.dumps(symbols, sort_keys=True)
            cache = self._stock_cache
            if cache.get("key") != key or time.time() - cache.get("fetched", 0.0) >= refresh_every:
                quotes = await fetch_quotes(symbols)
                cache["key"] = key
                cache["quotes"] = quotes
                cache["fetched"] = time.time()
                cache["idx"] = 0
            else:
                quotes = cache["quotes"]
                cache["idx"] = (cache.get("idx", 0) + 1) % max(1, len(quotes))
            quote = quotes[cache.get("idx", 0) % max(1, len(quotes))]
            if quote.get("ok"):
                sign = "+" if quote["change"] >= 0 else ""
                line = f"{quote['symbol']} {sign}{quote['change']}%"
            else:
                line = f"{quote['symbol']} n/a"
            return await self.runner(
                "text",
                {
                    "text": line,
                    "mode": 1,
                    "speed": max(0, min(255, int(cfg.get("speed", 80)))),
                    "size": 16,
                    "color": str(cfg.get("color", "#FFFFFF")),
                    "color_mode": 1,
                    "_automation": kind,
                },
            )
        if kind == "slideshow":
            media = self.list_media()
            if not media:
                raise ValueError("no media in photo frame (upload images first)")
            idx = int(cfg.get("index", 0)) % len(media)
            if cfg.get("shuffle"):
                idx = random.randrange(len(media))
            data = (self.media_dir / media[idx]["name"]).read_bytes()
            cfg["index"] = (idx + 1) % len(media)
            return await self.runner("image", {"image_base64": base64.b64encode(data).decode(), "_automation": kind})
        if kind == "clock":
            return await self.runner("clock", cfg)
        if kind == "effect":
            return await self.runner("animation", cfg)
        if kind == "text":
            return await self.runner("text", cfg)
        raise ValueError(f"unknown program: {kind}")

    # ------------------------------------------------------------------ media

    @property
    def media_dir(self) -> Path:
        return self.state_path.parent / "media"

    MAX_MEDIA = 4

    def add_media(self, data: bytes, name: str) -> dict[str, Any]:
        if len(self.list_media()) >= self.MAX_MEDIA:
            raise ValueError(f"photo frame is full ({self.MAX_MEDIA} photos) - remove one first")
        clean = self._store_media(data, name)
        log.info("media added: %s", clean)
        return {"name": clean, "count": len(self.list_media())}

    def _store_media(self, data: bytes, name: str) -> str:
        """Normalize an image to a 32x32 RGB PNG on disk and return its name."""
        import io

        self.media_dir.mkdir(parents=True, exist_ok=True)
        clean = "".join(ch for ch in Path(name).name if ch.isalnum() or ch in ".-_").strip()
        if not clean:
            raise ValueError("invalid media name")
        if not Path(clean).suffix:
            clean += ".png"
        if not clean.lower().endswith(".png"):
            clean = Path(clean).stem + ".png"
        try:
            with Image.open(io.BytesIO(data)) as img:
                img = img.convert("RGB")
                if img.size != (32, 32):
                    img = img.resize((32, 32), Image.NEAREST)
                buf = io.BytesIO()
                img.save(buf, format="PNG")
                normalized = buf.getvalue()
        except Exception:
            raise ValueError("file is not a valid image")
        path = self.media_dir / clean
        path.write_bytes(normalized)
        return clean

    async def sync_media(self, web_url: str) -> dict[str, Any]:
        """Mirror the cloud photo-frame catalog (Vercel Blob) into the local
        media dir so the slideshow can run against the display."""
        if not web_url:
            raise ValueError("webUrl is not configured on the bridge")
        catalog_url = f"{web_url.rstrip('/')}/api/media"
        try:
            catalog = await asyncio.to_thread(_http_json, catalog_url)
        except Exception as exc:  # noqa: BLE001
            raise ValueError(f"cloud media list unreachable: {exc}") from exc
        items = catalog.get("media") or []
        if len(items) > self.MAX_MEDIA:
            items = items[: self.MAX_MEDIA]

        def reconcile() -> dict[str, Any]:
            kept = {str(it.get("name", "")).strip() for it in items if it.get("name")}
            for path in self.media_dir.glob("*.png"):
                if path.name not in kept:
                    try:
                        path.unlink()
                    except OSError:
                        pass
            added: list[str] = []
            for it in items:
                name = str(it.get("name", "")).strip()
                url = str(it.get("url", "")).strip()
                if not name or not url or (self.media_dir / name).exists():
                    continue
                try:
                    data = _http_bytes(url)
                    self._store_media(data, name)
                    added.append(name)
                except Exception as exc:  # noqa: BLE001
                    log.warning("media-sync download failed for %s: %s", name, exc)
            return {"ok": True, "synced": len(added), "count": len(self.list_media())}

        return await asyncio.to_thread(reconcile)

    def remove_media(self, name: str) -> dict[str, Any]:
        path = self.media_dir / Path(name).name
        if not path.exists():
            raise ValueError(f"media not found: {name}")
        path.unlink()
        return {"removed": name, "count": len(self.list_media())}

    def list_media(self) -> list[dict[str, Any]]:
        if not self.media_dir.exists():
            return []
        items = []
        for path in sorted(self.media_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
            if path.is_file() and path.suffix.lower() in (".png", ".jpg", ".jpeg", ".gif", ".bmp"):
                items.append(
                    {
                        "name": path.name,
                        "size": path.stat().st_size,
                        "addedAt": int(path.stat().st_mtime * 1000),
                    }
                )
        return items[:200]


def _hex_to_rgb(value: str, default: tuple[int, int, int] = (255, 255, 255)) -> tuple[int, int, int]:
    value = value.strip().lstrip("#")
    if len(value) == 3:
        value = "".join(ch * 2 for ch in value)
    if len(value) != 6:
        return default
    try:
        return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]
    except ValueError:
        return default