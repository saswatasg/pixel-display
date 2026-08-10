"""DeviceManager: persistent BLE connection + serialized action execution.

Wraps the `idotmatrix` library (derkalle4/python3-idotmatrix-library).

Design:
- One shared ConnectionManager singleton from the library.
- A background reconnect loop keeps the BLE link alive (survives drops/wake).
- All actions are executed by a single worker task, so BLE writes never collide.
- Every action result is a dict: {"ok": bool, "sent": bool, "error": str|None}.
  "sent" means the bytes were handed to the radio (BLE writes are
  fire-and-forget; the display cannot ack rendering).
"""

from __future__ import annotations

import asyncio
import base64
import binascii
import logging
import re
import tempfile
import time
from pathlib import Path
from typing import Any, Awaitable, Callable, Optional

from idotmatrix import (
    Chronograph,
    Clock,
    Common,
    ConnectionManager,
    Countdown,
    Effect,
    FullscreenColor,
    Gif,
    Image,
    Scoreboard,
    Text,
)
from PIL import Image as PilImage

from config import Config
from automations import Automation

log = logging.getLogger("pixelbridge.device")

FONT_PATH = str(Path(__file__).parent / "fonts" / "Rain-DRM3.otf")

HEX_COLOR_RE = None  # replaced by a manual validator below

ANIMATION_STYLES = {
    0: "Graduated horizontal rainbow",
    1: "Random colored pixels on black",
    2: "Random white pixels on changing background",
    3: "Vertical rainbow",
    4: "Diagonal right rainbow",
    5: "Diagonal left rainbow on black",
    6: "Random colored pixels",
}


def hex_to_rgb(value: str, default: tuple[int, int, int] = (255, 255, 255)) -> tuple[int, int, int]:
    value = value.strip().lstrip("#")
    if len(value) == 3:
        value = "".join(ch * 2 for ch in value)
    if len(value) != 6:
        return default
    try:
        return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]
    except ValueError:
        return default


class DeviceManager:
    def __init__(self, config: Config) -> None:
        self.cfg = config
        self.conn = ConnectionManager()
        self.modules: dict[str, Any] = {
            "text": Text(),
            "image": Image(),
            "gif": Gif(),
            "clock": Clock(),
            "chronograph": Chronograph(),
            "countdown": Countdown(),
            "fullscreen": FullscreenColor(),
            "common": Common(),
            "effect": Effect(),
            "scoreboard": Scoreboard(),
        }
        self.queue: asyncio.Queue = asyncio.Queue()
        self.status: dict[str, Any] = {
            "connected": False,
            "address": self.cfg.address if self.cfg.address != "auto" else None,
            "lastAction": None,
            "lastError": None,
            "lastConnectedAt": None,
            "uptimeSec": 0.0,
        }
        self._started_at: float = time.time()
        self._tasks: list[asyncio.Task] = []
        self._stopping = False
        self.automation = Automation(Path("automation.json"), self.submit)

    # ---------------------------------------------------------------- lifecycle

    def start(self) -> None:
        self._tasks = [
            asyncio.create_task(self._reconnect_loop(), name="reconnect"),
            asyncio.create_task(self._worker(), name="worker"),
            asyncio.create_task(self.automation.start(), name="automation"),
        ]

    async def stop(self) -> None:
        self._stopping = True
        await self.automation.stop()
        for task in self._tasks:
            task.cancel()
        for task in self._tasks:
            try:
                await task
            except asyncio.CancelledError:
                pass
        try:
            await self.conn.disconnect()
        except Exception:  # noqa: BLE001
            pass

    # ------------------------------------------------------------- connection

    @property
    def is_connected(self) -> bool:
        return bool(self.conn.client and self.conn.client.is_connected)

    async def _reconnect_loop(self) -> None:
        failed_streak = 0
        while not self._stopping:
            try:
                if not self.is_connected:
                    if self.cfg.address == "auto":
                        await self.conn.connectBySearch()
                    else:
                        await self.conn.connectByAddress(self.cfg.address)
                    if self.is_connected:
                        self.status["connected"] = True
                        self.status["address"] = self.conn.address
                        self.status["lastConnectedAt"] = time.time()
                        self.status["lastError"] = None
                        failed_streak = 0
                        log.info("display connected: %s", self.conn.address)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001
                self.status["connected"] = False
                self.status["lastError"] = str(exc)
                failed_streak += 1
                if failed_streak >= 3:
                    # macOS CoreBluetooth can wedge after a drop; a fresh
                    # BleakClient gets a new CBCentralManager and recovers.
                    try:
                        await self.conn.disconnect()
                    except Exception:  # noqa: BLE001
                        pass
                    self.conn.client = None
                    failed_streak = 0
                log.warning("connection attempt failed: %s", exc)
            await asyncio.sleep(self.cfg.reconnect_interval)

    def _require_connection(self) -> None:
        if not self.is_connected:
            raise RuntimeError(
                f"display is not connected (address: {self.status['address'] or 'auto'})"
            )

    # ---------------------------------------------------------- action queueing

    async def submit(self, action: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Queue an action and wait for it to run (timeout: 60s)."""
        future: asyncio.Future = asyncio.get_running_loop().create_future()
        await self.queue.put((action, payload, future))
        await asyncio.wait_for(future, 60)
        return future.result()

    async def _worker(self) -> None:
        while not self._stopping:
            action, payload, future = await self.queue.get()
            try:
                result = await self._execute(action, payload)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001
                result = {"ok": False, "sent": False, "action": action, "error": str(exc)}
            try:
                future.set_result(result)
            except (asyncio.InvalidStateError, RuntimeError):
                # caller already gave up (submit timeout) - drop the result
                pass

    async def _execute(self, action: str, payload: dict[str, Any]) -> dict[str, Any]:
        handlers: dict[str, Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]] = {
            "text": self._act_text,
            "image": self._act_image,
            "gif": self._act_gif,
            "clock": self._act_clock,
            "brightness": self._act_brightness,
            "screen": self._act_screen,
            "flip": self._act_flip,
            "chronograph": self._act_chronograph,
            "countdown": self._act_countdown,
            "fullscreen-color": self._act_fullscreen_color,
            "animation": self._act_animation,
            "scoreboard": self._act_scoreboard,
            "sync-time": self._act_sync_time,
            "reset": self._act_reset,
            "weather": self._act_weather,
            "stocks": self._act_stocks,
            "slideshow": self._act_slideshow,
            "slideshow-next": self._act_slideshow_next,
            "scene": self._act_scene,
            "automation-off": self._act_automation_off,
            "media-add": self._act_media_add,
            "media-remove": self._act_media_remove,
        }
        if action not in handlers:
            raise ValueError(f"unknown action: {action}")
        result = await handlers[action](payload)
        result.setdefault("ok", True)
        result["action"] = action
        self.status["lastAction"] = {"action": action, "at": time.time()}
        return result

    # ------------------------------------------------------------------ actions

    async def _act_text(self, payload: dict[str, Any]) -> dict[str, Any]:
        text = str(payload.get("text", "")).strip()
        if not text:
            raise ValueError("text must not be empty")
        color_mode = int(payload.get("color_mode", 1))
        bg_mode = 1 if payload.get("bg_color") else 0
        sent = await self.modules["text"].setMode(
            text=text,
            font_size=int(payload.get("size", 16)),
            font_path=payload.get("font_path") or FONT_PATH,
            text_mode=int(payload.get("mode", 1)),
            speed=int(payload.get("speed", 95)),
            text_color_mode=color_mode,
            text_color=hex_to_rgb(str(payload.get("color", "#FFFFFF"))),
            text_bg_mode=bg_mode,
            text_bg_color=hex_to_rgb(str(payload.get("bg_color", "#000000")), (0, 0, 0)),
        )
        if sent is False:
            raise RuntimeError("library failed to send text")
        return {"sent": True, "chars": len(text)}

    async def _act_image(self, payload: dict[str, Any]) -> dict[str, Any]:
        data = self._extract_bytes(payload)
        if data is None:
            raise ValueError("image must be provided as 'image_base64' or a file upload")
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp.write(data)
            path = tmp.name
        try:
            # Firmware PNG decoder garbles RGBA - normalize to plain RGB.
            with PilImage.open(path) as im:
                im.convert("RGB").save(path)
            self._require_connection()
            await self.modules["image"].setMode(1)  # enter DIY draw mode
            result = await self.modules["image"].uploadProcessed(path, self.cfg.display_size)
            if result is False:
                raise RuntimeError("library failed to upload image")
            return {"sent": True, "bytes": len(data)}
        finally:
            Path(path).unlink(missing_ok=True)

    async def _act_gif(self, payload: dict[str, Any]) -> dict[str, Any]:
        data = self._extract_bytes(payload)
        if data is None:
            raise ValueError("gif must be provided as 'gif_base64' or a file upload")
        with tempfile.NamedTemporaryFile(suffix=".gif", delete=False) as tmp:
            tmp.write(data)
            path = tmp.name
        try:
            self._require_connection()
            try:
                result = await self.modules["gif"].uploadProcessed(path, self.cfg.display_size)
            except KeyError:
                # library reads img.info["duration"] which some GIFs lack
                result = await self.modules["gif"].uploadUnprocessed(path)
            if result is False:
                raise RuntimeError("library failed to upload gif")
            return {"sent": True, "bytes": len(data)}
        finally:
            Path(path).unlink(missing_ok=True)

    async def _act_clock(self, payload: dict[str, Any]) -> dict[str, Any]:
        style = int(payload.get("style", 0))
        if style not in range(0, 8):
            raise ValueError("clock style must be between 0 and 7")
        r, g, b = hex_to_rgb(str(payload.get("color", "#FFFFFF")))
        sent = await self.modules["clock"].setMode(
            style=style,
            visibleDate=bool(payload.get("showDate", True)),
            hour24=bool(payload.get("format24h", True)),
            r=r,
            g=g,
            b=b,
        )
        if sent is False:
            raise RuntimeError("library failed to set clock")
        if bool(payload.get("syncTime", True)):
            await self._act_sync_time({})
        return {"sent": True, "style": style}

    async def _act_sync_time(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = time.localtime()
        result = await self.modules["common"].setTime(
            year=now.tm_year,
            month=now.tm_mon,
            day=now.tm_mday,
            hour=now.tm_hour,
            minute=now.tm_min,
            second=now.tm_sec,
        )
        if result is False:
            raise RuntimeError("library failed to sync time")
        return {"sent": True}

    async def _act_brightness(self, payload: dict[str, Any]) -> dict[str, Any]:
        value = int(payload.get("value", 50))
        if value not in range(5, 101):
            raise ValueError("brightness must be between 5 and 100")
        sent = await self.modules["common"].setBrightness(value)
        if sent is False:
            raise RuntimeError("library failed to set brightness")
        return {"sent": True, "value": value}

    async def _act_screen(self, payload: dict[str, Any]) -> dict[str, Any]:
        power = str(payload.get("power", "on")).lower()
        if power not in ("on", "off"):
            raise ValueError("power must be 'on' or 'off'")
        await (self.modules["common"].screenOn() if power == "on" else self.modules["common"].screenOff())
        return {"sent": True, "power": power}

    async def _act_flip(self, payload: dict[str, Any]) -> dict[str, Any]:
        enabled = bool(payload.get("enabled", False))
        sent = await self.modules["common"].flipScreen(enabled)
        if sent is False:
            raise RuntimeError("library failed to flip screen")
        return {"sent": True, "enabled": enabled}

    async def _act_chronograph(self, payload: dict[str, Any]) -> dict[str, Any]:
        modes = {"reset": 0, "start": 1, "pause": 2, "resume": 3}
        mode = str(payload.get("mode", "start")).lower()
        if mode not in modes:
            raise ValueError("chronograph mode must be one of: reset, start, pause, resume")
        sent = await self.modules["chronograph"].setMode(modes[mode])
        if sent is False:
            raise RuntimeError("library failed to control chronograph")
        return {"sent": True, "mode": mode}

    async def _act_countdown(self, payload: dict[str, Any]) -> dict[str, Any]:
        if bool(payload.get("cancel")):
            sent = await self.modules["countdown"].setMode(0, 0, 0)
            if sent is False:
                raise RuntimeError("library failed to cancel countdown")
            return {"sent": True, "cancelled": True}
        seconds = int(payload.get("seconds", 0))
        if seconds not in range(1, 3600):
            raise ValueError("countdown seconds must be between 1 and 3599")
        minutes, secs = divmod(seconds, 60)
        sent = await self.modules["countdown"].setMode(1, minutes, secs)
        if sent is False:
            raise RuntimeError("library failed to set countdown")
        return {"sent": True, "seconds": seconds}

    async def _act_fullscreen_color(self, payload: dict[str, Any]) -> dict[str, Any]:
        r, g, b = hex_to_rgb(str(payload.get("color", "#000000")), (0, 0, 0))
        sent = await self.modules["fullscreen"].setMode(r, g, b)
        if sent is False:
            raise RuntimeError("library failed to set fullscreen color")
        return {"sent": True, "color": "#{:02x}{:02x}{:02x}".format(r, g, b)}

    async def _act_animation(self, payload: dict[str, Any]) -> dict[str, Any]:
        style = int(payload.get("style", 0))
        if style not in range(0, 7):
            raise ValueError("animation style must be between 0 and 6")
        raw_colors = payload.get("colors") or [
            (255, 0, 0),
            (255, 255, 0),
            (0, 255, 0),
            (0, 255, 255),
            (0, 0, 255),
            (255, 0, 255),
        ]
        colors: list[tuple[int, int, int]] = []
        for color in raw_colors[:7]:
            if isinstance(color, str):
                colors.append(hex_to_rgb(color))
            else:
                colors.append(tuple(int(c) % 256 for c in color))  # type: ignore[arg-type]
        if len(colors) < 2:
            raise ValueError("animation needs between 2 and 7 colors")
        sent = await self.modules["effect"].setMode(style, colors)
        if sent is False:
            raise RuntimeError("library failed to set animation")
        return {"sent": True, "style": style}

    async def _act_scoreboard(self, payload: dict[str, Any]) -> dict[str, Any]:
        score1 = max(0, min(999, int(payload.get("score1", 0))))
        score2 = max(0, min(999, int(payload.get("score2", 0))))
        sent = await self.modules["scoreboard"].setMode(score1, score2)
        if sent is False:
            raise RuntimeError("library failed to set scoreboard")
        return {"sent": True, "score1": score1, "score2": score2}

    async def _act_reset(self, payload: dict[str, Any]) -> dict[str, Any]:
        result = await self.modules["common"].reset()
        if result is False:
            raise RuntimeError("library failed to reset device")
        return {"sent": True}

    # -------------------------------------------------------------- automations

    async def _act_weather(self, payload: dict[str, Any]) -> dict[str, Any]:
        lat = float(payload.get("lat") or payload.get("latitude"))
        lon = float(payload.get("lon") or payload.get("longitude"))
        if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
            raise ValueError("invalid lat/lon")
        unit = "f" if str(payload.get("unit", "c")).lower() == "f" else "c"
        interval = max(15, min(360, int(payload.get("interval", 30))))
        name = str(payload.get("name", "")).strip()
        program = {
            "type": "weather",
            "config": {
                "lat": lat,
                "lon": lon,
                "unit": unit,
                "interval": interval,
                "color": str(payload.get("color", "#FFFFFF")),
                "name": name,
            },
        }
        self.automation.set_explicit(program)
        asyncio.create_task(self.automation.run_now())
        return {
            "sent": True,
            "queued": True,
            "enabled": True,
            "program": "weather",
            "city": name,
            "automation": self.automation.status,
        }

    async def _act_stocks(self, payload: dict[str, Any]) -> dict[str, Any]:
        symbols = [str(s).strip().upper() for s in payload.get("symbols", []) if str(s).strip()]
        if not symbols:
            raise ValueError("symbols must not be empty")
        interval = max(5, min(120, int(payload.get("interval", 10))))
        program = {
            "type": "stocks",
            "config": {
                "symbols": symbols[:4],
                "interval": interval,
                "color": str(payload.get("color", "#FFFFFF")),
            },
        }
        self.automation.set_explicit(program)
        asyncio.create_task(self.automation.run_now())
        return {
            "sent": True,
            "queued": True,
            "enabled": True,
            "program": "stocks",
            "symbols": symbols[:4],
            "automation": self.automation.status,
        }

    async def _act_slideshow(self, payload: dict[str, Any]) -> dict[str, Any]:
        media = self.automation.list_media()
        if not media:
            raise ValueError("photo frame is empty — upload images first")
        interval = max(5, min(3600, int(payload.get("interval", 20))))
        program = {
            "type": "slideshow",
            "config": {
                "interval": interval,
                "shuffle": bool(payload.get("shuffle", False)),
                "index": int(payload.get("index", 0)),
            },
        }
        self.automation.set_explicit(program)
        asyncio.create_task(self.automation.run_now())
        return {
            "sent": True,
            "queued": True,
            "enabled": True,
            "program": "slideshow",
            "photos": len(media),
            "automation": self.automation.status,
        }

    async def _act_slideshow_next(self, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.automation.enabled or not (self.automation.explicit or {}).get("type") == "slideshow":
            raise ValueError("slideshow is not active")
        cfg = self.automation.explicit.setdefault("config", {})
        cfg["index"] = int(cfg.get("index", 0)) + 1
        asyncio.create_task(self.automation.run_now())
        return {"sent": True, "queued": True, "program": "slideshow", "automation": self.automation.status}

    async def _act_scene(self, payload: dict[str, Any]) -> dict[str, Any]:
        playlist = payload.get("playlist")
        if playlist is not None:
            if not isinstance(playlist, list) or not playlist:
                raise ValueError("scene playlist must be a non-empty list of {start,end,program}")
            clean: list[dict[str, Any]] = []
            for entry in playlist:
                start = str(entry.get("start", "")).strip()
                end = str(entry.get("end", "")).strip()
                program = str(entry.get("program", "")).strip()
                if not re.fullmatch(r"\d{2}:\d{2}", start) or not re.fullmatch(r"\d{2}:\d{2}", end):
                    raise ValueError("scene times must use HH:MM")
                if program not in (
                    "weather", "stocks", "slideshow", "clock", "effect", "text",
                ):
                    raise ValueError(f"unknown scene program: {program}")
                clean.append({"start": start, "end": end, "program": program, "config": entry.get("config") or {}})
            self.automation.set_playlist(clean, enabled=bool(payload.get("enabled", True)))
            asyncio.create_task(self.automation.run_now())
            return {
                "sent": True,
                "queued": True,
                "enabled": True,
                "program": "scene",
                "entries": len(clean),
                "automation": self.automation.status,
            }
        self.automation.set_enabled(bool(payload.get("enabled", False)))
        return {"sent": True, "enabled": self.automation.enabled, "automation": self.automation.status}

    async def _act_automation_off(self, payload: dict[str, Any]) -> dict[str, Any]:
        self.automation.disable()
        return {"sent": True, "enabled": False, "automation": self.automation.status}

    async def _act_media_add(self, payload: dict[str, Any]) -> dict[str, Any]:
        data = self._extract_bytes(payload)
        if data is None:
            raise ValueError("media must be provided as 'file_base64' or a file upload")
        name = str(payload.get("name", "")).strip() or "photo.png"
        return self.automation.add_media(data, name)

    async def _act_media_remove(self, payload: dict[str, Any]) -> dict[str, Any]:
        name = str(payload.get("name", "")).strip()
        if not name:
            raise ValueError("name must not be empty")
        return self.automation.remove_media(name)

    # ----------------------------------------------------------------- helpers

    @staticmethod
    def _extract_bytes(payload: dict[str, Any]) -> Optional[bytes]:
        for key in ("image_base64", "gif_base64", "file_base64"):
            if payload.get(key):
                try:
                    return base64.b64decode(payload[key])
                except (binascii.Error, ValueError):
                    raise ValueError(f"{key} is not valid base64")
        return None

    def get_status(self) -> dict[str, Any]:
        return {
            "bridge": "online",
            "uptimeSec": round(time.time() - self._started_at, 1),
            "device": {
                "id": self.cfg.device_id,
                "name": f"IDM-{self.cfg.device_id}",
                "address": self.status["address"],
                "connected": self.is_connected,
                "displaySize": self.cfg.display_size,
                "lastAction": self.status["lastAction"],
                "lastError": self.status["lastError"],
                "lastConnectedAt": self.status["lastConnectedAt"],
            },
            "automation": self.automation.status,
            "media": {"count": len(self.automation.list_media())},
        }

    def get_capabilities(self) -> dict[str, Any]:
        """Self-describing action schema for future orchestrator UIs."""
        return {
            "deviceType": "idotmatrix-pixel-display",
            "deviceId": self.cfg.device_id,
            "displaySize": self.cfg.display_size,
            "actions": {
                "text": {
                    "title": "Display text",
                    "payloadSchema": {
                        "type": "object",
                        "properties": {
                            "text": {"type": "string", "minLength": 1},
                            "size": {"type": "integer", "minimum": 8, "maximum": 24, "default": 16},
                            "mode": {
                                "type": "integer",
                                "enum": [0, 1, 2, 3, 4, 5, 6, 7, 8],
                                "description": "0 replace, 1 marquee, 2 reversed marquee, 3 vertical rise, 4 vertical lower, 5 blink, 6 fade, 7 tetris, 8 fill",
                            },
                            "speed": {"type": "integer", "minimum": 1, "maximum": 100, "default": 95},
                            "color_mode": {
                                "type": "integer",
                                "enum": [0, 1, 3],
                                "description": "0 white, 1 custom RGB, 3 rainbow",
                            },
                            "color": {"type": "string", "pattern": "^#[0-9a-fA-F]{6}$"},
                            "bg_color": {"type": "string", "pattern": "^#[0-9a-fA-F]{6}$"},
                        },
                        "required": ["text"],
                    },
                },
                "image": {
                    "title": "Display image",
                    "payloadSchema": {
                        "type": "object",
                        "properties": {
                            "image_base64": {"type": "string"},
                        },
                        "oneOf": [{"required": ["image_base64"]}],
                    },
                },
                "gif": {
                    "title": "Display GIF",
                    "payloadSchema": {
                        "type": "object",
                        "properties": {
                            "gif_base64": {"type": "string"},
                        },
                        "oneOf": [{"required": ["gif_base64"]}],
                    },
                },
                "clock": {
                    "title": "Clock mode",
                    "payloadSchema": {
                        "type": "object",
                        "properties": {
                            "style": {"type": "integer", "minimum": 0, "maximum": 7},
                            "color": {"type": "string", "pattern": "^#[0-9a-fA-F]{6}$"},
                            "format24h": {"type": "boolean", "default": True},
                            "showDate": {"type": "boolean", "default": True},
                            "syncTime": {"type": "boolean", "default": True},
                        },
                    },
                },
                "brightness": {
                    "title": "Brightness",
                    "payloadSchema": {
                        "type": "object",
                        "properties": {
                            "value": {"type": "integer", "minimum": 5, "maximum": 100},
                        },
                        "required": ["value"],
                    },
                },
                "screen": {
                    "title": "Screen power",
                    "payloadSchema": {
                        "type": "object",
                        "properties": {
                            "power": {"type": "string", "enum": ["on", "off"]},
                        },
                        "required": ["power"],
                    },
                },
                "flip": {
                    "title": "Screen flip",
                    "payloadSchema": {
                        "type": "object",
                        "properties": {
                            "enabled": {"type": "boolean"},
                        },
                        "required": ["enabled"],
                    },
                },
                "chronograph": {
                    "title": "Chronograph",
                    "payloadSchema": {
                        "type": "object",
                        "properties": {
                            "mode": {"type": "string", "enum": ["reset", "start", "pause", "resume"]},
                        },
                        "required": ["mode"],
                    },
                },
                "countdown": {
                    "title": "Countdown timer",
                    "payloadSchema": {
                        "type": "object",
                        "properties": {
                            "seconds": {"type": "integer", "minimum": 1, "maximum": 3599},
                        },
                        "required": ["seconds"],
                    },
                },
                "fullscreen-color": {
                    "title": "Fullscreen color",
                    "payloadSchema": {
                        "type": "object",
                        "properties": {
                            "color": {"type": "string", "pattern": "^#[0-9a-fA-F]{6}$"},
                        },
                        "required": ["color"],
                    },
                },
                "animation": {
                    "title": "Animated effect",
                    "payloadSchema": {
                        "type": "object",
                        "properties": {
                            "style": {"type": "integer", "minimum": 0, "maximum": 6},
                            "colors": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 7},
                        },
                    },
                },
                "scoreboard": {
                    "title": "Scoreboard",
                    "payloadSchema": {
                        "type": "object",
                        "properties": {
                            "score1": {"type": "integer", "minimum": 0, "maximum": 999},
                            "score2": {"type": "integer", "minimum": 0, "maximum": 999},
                        },
                    },
                },
                "sync-time": {"title": "Sync device clock", "payloadSchema": {"type": "object"}},
                "reset": {"title": "Reset device", "payloadSchema": {"type": "object"}},
                "weather": {
                    "title": "Scheduled weather",
                    "payloadSchema": {
                        "type": "object",
                        "properties": {
                            "lat": {"type": "number"},
                            "lon": {"type": "number"},
                            "name": {"type": "string"},
                            "unit": {"type": "string", "enum": ["c", "f"]},
                            "interval": {"type": "integer", "minimum": 15, "maximum": 360},
                            "color": {"type": "string"},
                        },
                        "required": ["lat", "lon"],
                    },
                },
                "stocks": {
                    "title": "Stock ticker",
                    "payloadSchema": {
                        "type": "object",
                        "properties": {
                            "symbols": {"type": "array", "items": {"type": "string"}, "minItems": 1},
                            "interval": {"type": "integer", "minimum": 5, "maximum": 120},
                            "color": {"type": "string"},
                        },
                        "required": ["symbols"],
                    },
                },
                "slideshow": {
                    "title": "Photo frame",
                    "payloadSchema": {
                        "type": "object",
                        "properties": {
                            "interval": {"type": "integer", "minimum": 5, "maximum": 3600},
                            "shuffle": {"type": "boolean"},
                        },
                    },
                },
                "scene": {
                    "title": "Time-of-day scenes",
                    "payloadSchema": {
                        "type": "object",
                        "properties": {
                            "enabled": {"type": "boolean"},
                            "playlist": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "start": {"type": "string", "pattern": "^\\d{2}:\\d{2}$"},
                                        "end": {"type": "string", "pattern": "^\\d{2}:\\d{2}$"},
                                        "program": {"type": "string", "enum": ["weather", "stocks", "slideshow", "clock", "effect", "text"]},
                                        "config": {"type": "object"},
                                    },
                                },
                            },
                        },
                    },
                },
                "media-add": {"title": "Add photo to frame", "payloadSchema": {"type": "object", "properties": {"file_base64": {"type": "string"}}}},
                "media-remove": {
                    "title": "Remove photo from frame",
                    "payloadSchema": {
                        "type": "object",
                        "properties": {"name": {"type": "string"}},
                        "required": ["name"],
                    },
                },
            },
        }
