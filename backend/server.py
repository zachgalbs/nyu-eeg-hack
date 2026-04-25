"""FastAPI WebSocket server that streams eye tracking data to the frontend."""

import asyncio
import json
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from camera import CameraAnalyzer

# --- Shared state ---
latest_status: dict | None = None
alert_queue: asyncio.Queue = asyncio.Queue()
camera: CameraAnalyzer | None = None


def on_camera_event(event: dict):
    """Callback from the camera thread — runs in camera's thread."""
    global latest_status
    if event["event"] == "STATUS":
        latest_status = event
    else:
        # Alert events: push to async queue for broadcast
        try:
            alert_queue.put_nowait(event)
        except asyncio.QueueFull:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    global camera
    camera = CameraAnalyzer(on_event=on_camera_event)
    camera.start()
    yield
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

            # Drain any alert events
            while not alert_queue.empty():
                try:
                    alert = alert_queue.get_nowait()
                    await ws.send_json(alert)
                except asyncio.QueueFull:
                    break

            await asyncio.sleep(0.1)

    except WebSocketDisconnect:
        pass


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "camera_running": camera.running if camera else False,
        "timestamp": time.time(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
