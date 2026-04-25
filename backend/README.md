# Eye Tracking Backend

Real-time eye and gaze tracking server. Captures webcam input, runs MediaPipe face landmark detection, and streams focus metrics over WebSocket to the frontend dashboard.

## Architecture

```
Webcam → MediaPipe FaceLandmarker → CameraAnalyzer → FastAPI WebSocket → Frontend
```

Two files do all the work:

- **`camera.py`** — Runs in a background thread. Reads webcam frames, computes Eye Aspect Ratio (EAR), head orientation (pitch/yaw), cheek-based gaze direction, and phone detection. Emits events via callback.
- **`server.py`** — FastAPI app. Connects the camera to a WebSocket endpoint. Sends status updates at ~10fps and discrete alert events with cooldowns.

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python download_mediapipe_model.py
```

## Run

```bash
python server.py
```

Starts on **`http://localhost:8000`**. WebSocket at **`ws://localhost:8000/ws`**. Health check at **`GET /health`**.

## WebSocket Protocol

### Status (continuous, ~10fps)

Sent every ~100ms with the current tracking state:

```json
{
  "event": "STATUS",
  "timestamp": 1714000000.123,
  "data": {
    "face_detected": true,
    "ear": 0.312,
    "pitch": 2.1,
    "yaw": -1.3,
    "eyes_closed": false,
    "looking_away": false,
    "absent": false,
    "phone_detected": false,
    "focused": true
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `face_detected` | bool | Whether a face is visible in the frame |
| `ear` | float | Eye Aspect Ratio (0-0.5). Below 0.25 = eyes closed |
| `pitch` | float | Head pitch in degrees (positive = looking down) |
| `yaw` | float | Head yaw in degrees (positive = looking right) |
| `eyes_closed` | bool | Sustained eye closure detected (drowsiness) |
| `looking_away` | bool | User is not facing the screen |
| `absent` | bool | No face detected for extended period |
| `phone_detected` | bool | Mobile phone visible in frame |
| `focused` | bool | Composite: face present, eyes open, facing screen, no phone |

### Alerts (discrete, with cooldowns)

Sent when a state change is first detected. Each type has a cooldown to prevent spam.

| Event | Cooldown | Data |
|-------|----------|------|
| `EYES_CLOSED` | 5s | `{ "ear": 0.18 }` |
| `LOOKING_AWAY` | 5s | `{ "offscreen_frames": 30 }` |
| `NOT_PRESENT` | 20s | `{ "absent_frames": 100 }` |
| `DEVICE_DETECTED` | 5s | `{}` |
| `USER_BACK` | — | `{ "duration": 12.5 }` |

### Frontend usage

```typescript
const ws = new WebSocket("ws://localhost:8000/ws");

ws.onmessage = (msg) => {
  const event = JSON.parse(msg.data);

  if (event.event === "STATUS") {
    // Update UI with event.data.focused, event.data.ear, etc.
  } else {
    // Handle alert: event.event is "EYES_CLOSED", "LOOKING_AWAY", etc.
  }
};
```

## Detection Details

### Eye Aspect Ratio (EAR)

Measures eye openness using 6 landmarks per eye. Ratio of vertical to horizontal distances. Falls below 0.25 when eyes close. Alert fires after 100 consecutive closed-eye frames (~3s at 30fps).

### Gaze Direction

Uses cheek landmark z-depth asymmetry to detect when the user turns away from the screen. Three methods combined: cheek z-diff, cheek-to-nose distance ratio, and cheek-to-nose z-depth. Alert fires after 30 consecutive off-screen frames (~1s).

### Head Orientation

Pitch and yaw calculated from nose position relative to eye midpoint and face height. Reported in degrees. Not used for alerts directly — available for frontend visualization.

### Phone Detection

Optional. Uses EfficientDet-Lite0 object detector to find "cell phone" category objects in frame. Requires `efficientdet_lite0.tflite` model file. Gracefully disabled if model is missing.

### Absence

No face detected for 100+ consecutive frames triggers `NOT_PRESENT`. When face reappears, `USER_BACK` fires with the absence duration.

## Files

```
backend/
├── server.py                   # FastAPI WebSocket server (entry point)
├── camera.py                   # MediaPipe eye/gaze tracking thread
├── download_mediapipe_model.py # Downloads face_landmarker.task
├── face_landmarker.task        # MediaPipe model (4MB, downloaded)
├── efficientdet_lite0.tflite   # Object detection model (7MB, optional)
├── requirements.txt            # Python dependencies
└── .gitignore
```

## Requirements

- Python 3.10+
- Webcam
- macOS / Linux (no Windows-specific dependencies)
