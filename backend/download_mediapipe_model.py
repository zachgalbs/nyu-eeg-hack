"""Download MediaPipe Face Landmarker model."""
import os
import urllib.request

MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
MODEL_PATH = os.path.join(os.path.dirname(__file__), "face_landmarker.task")


def download_model():
    print(f"Downloading: {MODEL_URL}")
    try:
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        size_mb = os.path.getsize(MODEL_PATH) / (1024 * 1024)
        print(f"[OK] Saved to {MODEL_PATH} ({size_mb:.1f} MB)")
    except Exception as e:
        print(f"[ERROR] Download failed: {e}")
        return False
    return True


if __name__ == "__main__":
    download_model()
