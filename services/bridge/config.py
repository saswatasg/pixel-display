"""Configuration for the pixel display bridge.

Loads from a JSON config file, with environment variable overrides:
    PIXEL_BRIDGE_CONFIG   path to the config file (default: ./config.json)
    PIXEL_BRIDGE_API_KEY  override apiKey
    PIXEL_BRIDGE_ADDRESS  override device address ("auto" = scan for IDM-* devices)
    PIXEL_BRIDGE_PORT     override listen port
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

DEFAULT_CONFIG = {
    "host": "127.0.0.1",
    "port": 8000,
    "apiKey": "change-me",
    "address": "auto",
    "deviceId": "pixel-display",
    "displaySize": 32,
    "reconnectIntervalSec": 5,
    "webUrl": "https://pixel-display-controller.vercel.app",
    # CORS only matters when a browser can reach the bridge; restrict to the
    # web app + local dev. The bridge key remains the real gate.
    "allowedOrigins": ["https://pixel-display-controller.vercel.app", "http://localhost:3000"],
}


def _deep_merge(base: dict, override: dict) -> dict:
    result = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


class Config:
    def __init__(self) -> None:
        raw: dict[str, Any] = dict(DEFAULT_CONFIG)
        config_path = os.environ.get("PIXEL_BRIDGE_CONFIG", "config.json")
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                raw = _deep_merge(raw, json.load(f))
        if os.environ.get("PIXEL_BRIDGE_API_KEY"):
            raw["apiKey"] = os.environ["PIXEL_BRIDGE_API_KEY"]
        if os.environ.get("PIXEL_BRIDGE_ADDRESS"):
            raw["address"] = os.environ["PIXEL_BRIDGE_ADDRESS"]
        if os.environ.get("PIXEL_BRIDGE_PORT"):
            raw["port"] = int(os.environ["PIXEL_BRIDGE_PORT"])
        self.host: str = raw["host"]
        self.port: int = int(raw["port"])
        self.api_key: str = str(raw["apiKey"])
        self.address: str = str(raw["address"])
        self.device_id: str = str(raw["deviceId"])
        self.display_size: int = int(raw["displaySize"])
        self.reconnect_interval: int = int(raw["reconnectIntervalSec"])
        self.web_url: str = str(raw.get("webUrl") or "").strip()
        self.allowed_origins: list[str] = list(raw["allowedOrigins"])

    @property
    def config_path(self) -> Path:
        return Path(os.environ.get("PIXEL_BRIDGE_CONFIG", "config.json")).resolve()
