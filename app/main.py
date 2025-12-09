# app/main.py
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from ultralytics import YOLO
import cv2
import numpy as np

# Load model + GPU
MODEL_PATH = Path(__file__).parent.parent / "models" / "best.pt"
if not MODEL_PATH.exists():
    raise FileNotFoundError(f"Put your best.pt here → {MODEL_PATH}")

model = YOLO(MODEL_PATH)
print(f"YOLOv11 loaded from {MODEL_PATH}")
print("Classes:", list(model.names.values()))

# Force GPU
import torch
if torch.cuda.is_available():
    model.model.to('cuda')
    print(f"GPU ACTIVE: {torch.cuda.get_device_name(0)}")
else:
    print("Running on CPU")

BASE_DIR = Path(__file__).parent.parent
app = FastAPI()

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

@app.get("/")
async def root():
    return FileResponse(BASE_DIR / "static" / "index.html")

@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    # Read webcam frame
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # DEBUG: Save the actual frame the server receives
    cv2.imwrite("debug_last_frame.jpg", img)
    print(f"Saved debug_last_frame.jpg → shape: {img.shape}, mean pixel value: {img.mean():.1f}")

    # THIS IS THE KEY: Resize exactly like training
    img_resized = cv2.resize(img, (640, 640))

    # Run inference
    results = model(img_resized, conf=0.25, iou=0.45, verbose=False)[0]

    detections = []
    orig_h, orig_w = img.shape[:2]

    for box in results.boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        conf = float(box.conf)
        cls_id = int(box.cls[0])
        name = results.names[cls_id]

        # Scale back to original webcam resolution
        x1 = int(x1 * orig_w / 640)
        y1 = int(y1 * orig_h / 640)
        x2 = int(x2 * orig_w / 640)
        y2 = int(y2 * orig_h / 640)

        detections.append({
            "class": name,
            "confidence": round(conf, 3),
            "box": [x1, y1, x2, y2]
        })

    # Debug: print what we actually return
    print("Sending detections →", detections)

    return {
    "detections": detections,
    "orig_width": orig_w,
    "orig_height": orig_h
    }