"""Pixel Display Bridge - FastAPI service.

Control an APEX/iDotMatrix 32x32 LED display over BLE from anywhere,
via REST/WebSocket. Designed as a self-contained "device module" for a
future home-automation platform (see docs/device-module-spec.md).

Run locally:
    python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    cp config.example.json config.json   # set your apiKey + device address
    uvicorn app:app --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config import Config
from device import ANIMATION_STYLES, DeviceManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("pixelbridge")

config = Config()
manager = DeviceManager(config)

MAX_UPLOAD_BYTES = 5 * 1024 * 1024


@asynccontextmanager
async def lifespan(app: FastAPI):
    manager.start()
    log.info(
        "pixel bridge started (device: %s, address: %s, api key: %s)",
        config.device_id,
        config.address,
        "set" if config.api_key != "change-me" else "DEFAULT (change-me!)",
    )
    yield
    await manager.stop()


app = FastAPI(title="Pixel Display Bridge", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_key(x_api_key: str = Header(default="")) -> None:
    if x_api_key != config.api_key:
        raise HTTPException(status_code=401, detail="invalid or missing X-API-Key")


async def run_action(action: str, payload: dict[str, Any]) -> dict[str, Any]:
    try:
        result = await manager.submit(action, payload)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="action timed out")
    if not result.get("ok"):
        raise HTTPException(status_code=502, detail=result.get("error") or "action failed")
    return result


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    return {"status": "ok"}


@app.get("/status")
async def status(_: None = Depends(require_key)) -> dict[str, Any]:
    return manager.get_status()


@app.get("/capabilities")
async def capabilities(_: None = Depends(require_key)) -> dict[str, Any]:
    return manager.get_capabilities()


async def _receive_upload_bytes(request: Request, keys: tuple[str, ...]) -> bytes:
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        file = form.get("file")
        if file is None:
            raise HTTPException(status_code=400, detail="multipart upload requires a 'file' field")
        data = await file.read()
    else:
        body = await request.json()
        data = None
        for key in keys:
            if body.get(key):
                import base64

                try:
                    data = base64.b64decode(body[key])
                except Exception:
                    raise HTTPException(status_code=400, detail=f"{key} is not valid base64")
                break
        if data is None:
            raise HTTPException(status_code=400, detail=f"body must contain one of: {', '.join(keys)}")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="upload exceeds 5 MB")
    return data


@app.post("/actions/image")
async def action_image(request: Request, _: None = Depends(require_key)) -> dict[str, Any]:
    data = await _receive_upload_bytes(request, ("image_base64", "file_base64"))
    return await run_action("image", {"image_base64": __import__("base64").b64encode(data).decode()})


@app.post("/actions/gif")
async def action_gif(request: Request, _: None = Depends(require_key)) -> dict[str, Any]:
    data = await _receive_upload_bytes(request, ("gif_base64", "file_base64"))
    return await run_action("gif", {"gif_base64": __import__("base64").b64encode(data).decode()})


@app.post("/actions/media-add")
async def action_media_add(request: Request, _: None = Depends(require_key)) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    name = ""
    if request.headers.get("content-type", "").startswith("multipart/form-data"):
        form = await request.form()
        file = form.get("file")
        if file is None:
            raise HTTPException(status_code=400, detail="multipart upload requires a 'file' field")
        data = await file.read()
        name = str(form.get("name") or "") or str(getattr(file, "filename", "") or "")
    else:
        data = await _receive_upload_bytes(request, ("file_base64",))
        name = request.query_params.get("name") or ""
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="upload exceeds 5 MB")
    payload["file_base64"] = __import__("base64").b64encode(data).decode()
    if name:
        payload["name"] = name
    return await run_action("media-add", payload)


@app.get("/actions/media-list")
async def action_media_list(_: None = Depends(require_key)) -> dict[str, Any]:
    return {"ok": True, "media": manager.automation.list_media()}


@app.post("/actions/{action}")
async def action_generic(action: str, request: Request, _: None = Depends(require_key)) -> dict[str, Any]:
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="body must be a JSON object")
    return await run_action(action, payload)


@app.get("/devices/{device_id}")
async def device_get(device_id: str, _: None = Depends(require_key)) -> dict[str, Any]:
    if device_id != config.device_id:
        raise HTTPException(status_code=404, detail="unknown device")
    status = manager.get_status()
    return {
        "id": device_id,
        "name": status["device"]["name"],
        "type": "idotmatrix-pixel-display",
        "connected": status["device"]["connected"],
        "state": {"brightness": None, "power": None, "address": status["device"]["address"]},
    }


@app.get("/devices/{device_id}/capabilities")
async def device_capabilities(device_id: str, _: None = Depends(require_key)) -> dict[str, Any]:
    if device_id != config.device_id:
        raise HTTPException(status_code=404, detail="unknown device")
    return manager.get_capabilities()


@app.get("/devices/{device_id}/status")
async def device_status(device_id: str, _: None = Depends(require_key)) -> dict[str, Any]:
    if device_id != config.device_id:
        raise HTTPException(status_code=404, detail="unknown device")
    return manager.get_status()


@app.post("/devices/{device_id}/actions/{action}")
async def device_action(device_id: str, action: str, request: Request, _: None = Depends(require_key)) -> dict[str, Any]:
    if device_id != config.device_id:
        raise HTTPException(status_code=404, detail="unknown device")
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="body must be a JSON object")
    return await run_action(action, payload)


@app.websocket("/ws/status")
async def ws_status(websocket: WebSocket) -> None:
    if websocket.query_params.get("key") != config.api_key:
        await websocket.close(code=4401)
        return
    await websocket.accept()
    try:
        while True:
            await websocket.send_json(manager.get_status())
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        pass


@app.get("/debug/actions")
async def debug_actions(_: None = Depends(require_key)) -> dict[str, Any]:
    """List actions with human-readable descriptions (for the settings screen)."""
    return {"animationStyles": ANIMATION_STYLES}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=config.host, port=config.port)
