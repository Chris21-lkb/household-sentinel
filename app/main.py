# app/main.py
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from ultralytics import YOLO
import cv2
import numpy as np

# ────────────────────────────────
# Load YOLOv11 model (GPU auto-detected)
# ────────────────────────────────
MODEL_PATH = Path(__file__).parent.parent / "models" / "best.pt"

if not MODEL_PATH.exists():
    raise FileNotFoundError(f"Model not found! Put your best.pt in: {MODEL_PATH}")

model = YOLO(MODEL_PATH)  # Automatically uses RTX 3060 if available

device = "CUDA" if model.device.type == "cuda" else "CPU"
print(f"Household Sentinel LIVE → YOLOv11 loaded on {device}")
print(f"Classes: {list(model.names.values())}")

# ────────────────────────────────
# FastAPI app
# ────────────────────────────────
BASE_DIR = Path(__file__).parent.parent
app = FastAPI(title="Household Sentinel")

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

@app.get("/")
async def root():
    return FileResponse(BASE_DIR / "static" / "index.html")

@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    # Read uploaded frame
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # YOLOv11 inference (one magic line)
    results = model(img, conf=0.4, iou=0.45, verbose=False)[0]

    detections = []
    for box in results.boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        conf = float(box.conf[0])
        cls_id = int(box.cls[0])
        class_name = results.names[cls_id]

        detections.append({
            "class": class_name,
            "confidence": round(conf, 3),
            "box": [x1, y1, x2, y2]
        })

    return {"detections": detections}