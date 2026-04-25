"""FastAPI WebSocket server that streams eye tracking data to the frontend."""

import asyncio
import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from camera import CameraAnalyzer

# --- Shared state ---
latest_status: Optional[dict] = None
alert_queue: asyncio.Queue = asyncio.Queue()
camera: Optional[CameraAnalyzer] = None
camera_error: Optional[str] = None
event_loop: Optional[asyncio.AbstractEventLoop] = None


def _enqueue_alert(event: dict):
    try:
        alert_queue.put_nowait(event)
    except asyncio.QueueFull:
        pass


def on_camera_event(event: dict):
    """Callback from the camera thread — runs in camera's thread."""
    global latest_status
    if event["event"] == "STATUS":
        latest_status = event
    else:
        # Alert events cross thread boundary via thread-safe event loop callback.
        if event_loop:
            event_loop.call_soon_threadsafe(_enqueue_alert, event)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global camera, camera_error, event_loop
    event_loop = asyncio.get_running_loop()
    try:
        camera = CameraAnalyzer(on_event=on_camera_event)
        camera.start()
        camera_error = None
    except Exception as exc:
        # Keep API alive even when camera/model init fails in demo/prod envs.
        camera = None
        camera_error = str(exc)
        print(f"[WARN] Camera disabled: {camera_error}")
    yield
    if camera:
        camera.stop()
        camera.join(timeout=3)


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()

    try:
        while True:
            # Send latest status at ~10 fps
            if latest_status is not None:
                await ws.send_json(latest_status)
            elif camera is None:
                await ws.send_json(
                    {
                        "event": "STATUS",
                        "timestamp": time.time(),
                        "data": {
                            "face_detected": False,
                            "ear": 0.0,
                            "pitch": 0.0,
                            "yaw": 0.0,
                            "eyes_closed": False,
                            "looking_away": False,
                            "absent": True,
                            "phone_detected": False,
                            "focused": False,
                            "camera_available": False,
                        },
                    }
                )

            # Drain any alert events
            while not alert_queue.empty():
                try:
                    alert = alert_queue.get_nowait()
                    await ws.send_json(alert)
                except asyncio.QueueEmpty:
                    break

            await asyncio.sleep(0.1)

    except WebSocketDisconnect:
        pass


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "camera_running": camera.running if camera else False,
        "camera_available": camera is not None,
        "camera_error": camera_error,
        "timestamp": time.time(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
