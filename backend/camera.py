import threading
import cv2
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from mediapipe import Image as MPImage
from mediapipe.tasks.python.vision.core.image import ImageFormat
import numpy as np
import time
import os


class CameraAnalyzer(threading.Thread):
    """Webcam eye/gaze tracker using MediaPipe FaceLandmarker.

    Runs in a background thread. Calls `on_event(event_dict)` for each frame
    with current tracking status.
    """

    def __init__(self, on_event=None):
        super().__init__(daemon=True)
        self.on_event = on_event
        self.running = False

        # --- MediaPipe Face Landmarker ---
        model_path = os.path.join(os.path.dirname(__file__), "face_landmarker.task")
        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"Model not found: {model_path}\nRun: python download_mediapipe_model.py"
            )

        options = vision.FaceLandmarkerOptions(
            base_options=python.BaseOptions(model_asset_path=model_path),
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=False,
            num_faces=1,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
            min_tracking_confidence=0.5,
            running_mode=vision.RunningMode.IMAGE,
        )
        self.face_landmarker = vision.FaceLandmarker.create_from_options(options)

        # --- Object Detector for phone detection (optional) ---
        object_model_path = os.path.join(os.path.dirname(__file__), "efficientdet_lite0.tflite")
        self.object_detector = None
        if os.path.exists(object_model_path):
            try:
                obj_options = vision.ObjectDetectorOptions(
                    base_options=python.BaseOptions(model_asset_path=object_model_path),
                    max_results=5,
                    score_threshold=0.4,
                    category_allowlist=["cell phone"],
                )
                self.object_detector = vision.ObjectDetector.create_from_options(obj_options)
            except Exception:
                pass

        # --- State counters ---
        self.blink_frames = 0
        self.absent_frames = 0
        self.offscreen_frames = 0
        self.last_alert_time: dict[str, float] = {}

        # --- Thresholds ---
        self.EAR_THRESHOLD = 0.25
        self.BLINK_FRAMES = 100
        self.NO_FACE_FRAMES = 100
        self.GAZE_AWAY_FRAMES = 30

        # --- Landmark indices ---
        self.LEFT_EYE_EAR = [33, 160, 158, 133, 153, 144]
        self.RIGHT_EYE_EAR = [362, 385, 387, 263, 390, 374]
        self.LEFT_EYE_INNER, self.LEFT_EYE_OUTER = 133, 33
        self.RIGHT_EYE_INNER, self.RIGHT_EYE_OUTER = 362, 263
        self.FOREHEAD = 10
        self.NOSE_TIP = 1
        self.CHIN = 175
        self.LEFT_CHEEK = 118
        self.RIGHT_CHEEK = 347

        # Cheek visibility thresholds
        self.CHEEK_Z_DEPTH_THRESHOLD = 0.08
        self.CHEEK_POSITION_THRESHOLD = 0.25
        self.CHEEK_NOSE_Z_THRESHOLD = 0.12
        self.CHEEK_Z_DIFF_PASS = 0.015

        # Absence tracking
        self.user_absent = False
        self.absence_start = 0.0

    # ---- helpers ----

    def _eye_ratio(self, lm, idx):
        v1 = np.linalg.norm(
            np.array([lm[idx[1]].x, lm[idx[1]].y]) - np.array([lm[idx[5]].x, lm[idx[5]].y])
        )
        v2 = np.linalg.norm(
            np.array([lm[idx[2]].x, lm[idx[2]].y]) - np.array([lm[idx[4]].x, lm[idx[4]].y])
        )
        h = np.linalg.norm(
            np.array([lm[idx[0]].x, lm[idx[0]].y]) - np.array([lm[idx[3]].x, lm[idx[3]].y])
        )
        return (v1 + v2) / (2.0 * h) if h > 0 else 0.0

    def _face_forward(self, lm):
        try:
            lc, rc, nose = lm[self.LEFT_CHEEK], lm[self.RIGHT_CHEEK], lm[self.NOSE_TIP]
            lz, rz, nz = getattr(lc, "z", 0.0), getattr(rc, "z", 0.0), getattr(nose, "z", 0.0)
            z_diff = abs(lz - rz)

            if z_diff < self.CHEEK_Z_DIFF_PASS:
                return True
            if z_diff > self.CHEEK_Z_DEPTH_THRESHOLD:
                return False

            ld = np.hypot(lc.x - nose.x, lc.y - nose.y)
            rd = np.hypot(rc.x - nose.x, rc.y - nose.y)
            if max(ld, rd) > 0.01:
                if abs(ld - rd) / max(ld, rd) > self.CHEEK_POSITION_THRESHOLD and z_diff > self.CHEEK_Z_DEPTH_THRESHOLD * 0.7:
                    return False

            if abs(nz) > 0.001:
                if (abs(lz - nz) > self.CHEEK_NOSE_Z_THRESHOLD or abs(rz - nz) > self.CHEEK_NOSE_Z_THRESHOLD) and z_diff > self.CHEEK_Z_DEPTH_THRESHOLD * 0.7:
                    return False

            return True
        except (IndexError, AttributeError):
            return False

    def _head_orientation(self, lm):
        def p(l):
            return np.array([l.x, l.y])

        le = (p(lm[self.LEFT_EYE_INNER]) + p(lm[self.LEFT_EYE_OUTER])) / 2
        re = (p(lm[self.RIGHT_EYE_INNER]) + p(lm[self.RIGHT_EYE_OUTER])) / 2
        eye_c = (le + re) / 2
        nose = p(lm[self.NOSE_TIP])
        forehead = p(lm[self.FOREHEAD])
        chin = p(lm[self.CHIN])

        eye_dist = np.linalg.norm(re - le)
        face_h = np.linalg.norm(chin - forehead)

        yaw = ((nose[0] - eye_c[0]) / eye_dist * 60.0) if eye_dist > 0 else 0.0
        pitch = ((nose[1] - eye_c[1] - 0.05) / face_h * 60.0) if face_h > 0 else 0.0
        return pitch, yaw

    def _should_notify(self, event_type, cooldown=5.0):
        now = time.time()
        if now - self.last_alert_time.get(event_type, 0) < cooldown:
            return False
        self.last_alert_time[event_type] = now
        return True

    def _emit(self, event_type, data):
        if self.on_event:
            self.on_event({"event": event_type, "data": data, "timestamp": time.time()})

    # ---- main loop ----

    def stop(self):
        self.running = False

    def run(self):
        self.running = True
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("[ERROR] Could not open webcam")
            return

        print("[OK] Camera analyzer started")

        try:
            while self.running:
                ret, frame = cap.read()
                if not ret:
                    continue

                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = MPImage(image_format=ImageFormat.SRGB, data=frame_rgb)
                result = self.face_landmarker.detect(mp_image)

                is_sleeping = False
                is_absent = False
                is_gaze_away = False
                is_phone = False
                avg_ear = 0.0
                pitch, yaw = 0.0, 0.0

                # Phone detection
                if self.object_detector:
                    try:
                        obj_result = self.object_detector.detect(mp_image)
                        if obj_result.detections:
                            for det in obj_result.detections:
                                for cat in det.categories:
                                    if cat.category_name == "cell phone" and cat.score >= 0.4:
                                        is_phone = True
                                        break
                                if is_phone:
                                    break
                    except Exception:
                        pass

                if result.face_landmarks:
                    self.absent_frames = 0
                    lm = result.face_landmarks[0]

                    # Eye aspect ratio
                    left_ear = self._eye_ratio(lm, self.LEFT_EYE_EAR)
                    right_ear = self._eye_ratio(lm, self.RIGHT_EYE_EAR)
                    avg_ear = (left_ear + right_ear) / 2.0

                    self.blink_frames = self.blink_frames + 1 if avg_ear < self.EAR_THRESHOLD else 0
                    if self.blink_frames >= self.BLINK_FRAMES:
                        is_sleeping = True

                    pitch, yaw = self._head_orientation(lm)

                    if not self._face_forward(lm):
                        self.offscreen_frames += 1
                    else:
                        self.offscreen_frames = 0
                    if self.offscreen_frames >= self.GAZE_AWAY_FRAMES:
                        is_gaze_away = True

                    # User returned after absence
                    if self.user_absent:
                        duration = time.time() - self.absence_start
                        self._emit("USER_BACK", {"duration": round(duration, 1)})
                        self.user_absent = False
                else:
                    self.absent_frames += 1
                    self.blink_frames = 0
                    self.offscreen_frames = 0
                    if self.absent_frames >= self.NO_FACE_FRAMES:
                        is_absent = True

                # Discrete alert events (with cooldowns)
                if is_sleeping and self._should_notify("EYES_CLOSED"):
                    self._emit("EYES_CLOSED", {"ear": round(avg_ear, 3)})
                if is_absent:
                    if not self.user_absent:
                        self.user_absent = True
                        self.absence_start = time.time()
                    if self._should_notify("NOT_PRESENT", cooldown=20.0):
                        self._emit("NOT_PRESENT", {"absent_frames": self.absent_frames})
                if is_gaze_away and self._should_notify("LOOKING_AWAY"):
                    self._emit("LOOKING_AWAY", {"offscreen_frames": self.offscreen_frames})
                if is_phone and self._should_notify("DEVICE_DETECTED"):
                    self._emit("DEVICE_DETECTED", {})

                # Continuous status (every frame)
                self._emit("STATUS", {
                    "face_detected": bool(result.face_landmarks),
                    "ear": round(avg_ear, 3),
                    "pitch": round(pitch, 1),
                    "yaw": round(yaw, 1),
                    "eyes_closed": is_sleeping,
                    "looking_away": is_gaze_away,
                    "absent": is_absent,
                    "phone_detected": is_phone,
                    "focused": bool(result.face_landmarks) and not is_sleeping and not is_gaze_away and not is_phone,
                })

        finally:
            cap.release()
            self.running = False
            print("[OK] Camera analyzer stopped")
