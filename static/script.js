// static/script.js — FINAL DUAL-CANVAS VERSION

const video = document.getElementById('video');
const videoCanvas = document.getElementById('videoCanvas');
const boxCanvas = document.getElementById('boxCanvas');

const videoCtx = videoCanvas.getContext('2d');
const boxCtx = boxCanvas.getContext('2d');

const detectionList = document.getElementById('detectionList');
const status = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const videoContainer = document.getElementById('videoContainer');

let stream = null;
let processing = false;

function resizeCanvases() {
    videoCanvas.width = video.videoWidth;
    videoCanvas.height = video.videoHeight;

    boxCanvas.width = video.videoWidth;
    boxCanvas.height = video.videoHeight;
}

startBtn.addEventListener('click', async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;

        status.textContent = "ACTIVATED • Processing Frames";
        status.className = "text-blue-400 font-bold animate-pulse";

        startBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');

        videoContainer.classList.add('shadow-glow-primary');

        detectionList.innerHTML = "";

        video.onloadedmetadata = () => {
            resizeCanvases();
            detectFrame();
        };

    } catch (error) {
        console.error("Camera error:", error);
        status.textContent = "CAMERA ERROR";
        status.className = "text-red-500 font-bold";
    }
});

stopBtn.addEventListener('click', () => {
    if (stream) stream.getTracks().forEach(track => track.stop());

    video.srcObject = null;
    videoCtx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);
    boxCtx.clearRect(0, 0, boxCanvas.width, boxCanvas.height);

    status.textContent = "Offline";
    status.className = "text-green-500 font-bold";

    detectionList.innerHTML =
        '<li class="text-slate-500">System awaiting activation...</li>';

    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');

    videoContainer.classList.remove('shadow-glow-primary');
});

async function detectFrame() {
    if (!video.paused && !processing) {
        processing = true;

        // draw current frame
        videoCtx.drawImage(video, 0, 0, videoCanvas.width, videoCanvas.height);

        const imageBlob = await new Promise(resolve =>
            videoCanvas.toBlob(resolve, "image/jpeg", 0.85)
        );

        const formData = new FormData();
        formData.append("file", imageBlob, "frame.jpg");

        try {
            const response = await fetch("/detect", { method: "POST", body: formData });
            const result = await response.json();

            // Clear box canvas only
            boxCtx.clearRect(0, 0, boxCanvas.width, boxCanvas.height);
            detectionList.innerHTML = "";

            const scaleX = boxCanvas.width / result.orig_width;
            const scaleY = boxCanvas.height / result.orig_height;

            result.detections.forEach(d => {
                const [x1o, y1o, x2o, y2o] = d.box;
                const x1 = x1o * scaleX;
                const y1 = y1o * scaleY;
                const x2 = x2o * scaleX;
                const y2 = y2o * scaleY;

                // draw box
                boxCtx.strokeStyle = "#00D1FF";
                boxCtx.lineWidth = 4;
                boxCtx.strokeRect(x1, y1, x2 - x1, y2 - y1);

                // draw label
                const conf = (d.confidence * 100).toFixed(1);
                const text = `${d.class} ${conf}%`;
                boxCtx.font = "bold 20px monospace";
                const tw = boxCtx.measureText(text).width;
                const th = 24;
                const ty = y1 > th ? y1 - th : y1 + 5;

                boxCtx.fillStyle = "#00D1FF";
                boxCtx.fillRect(x1, ty, tw + 10, th);

                boxCtx.fillStyle = "#0F172A";
                boxCtx.fillText(text, x1 + 5, ty + 18);

                // update list
                const li = document.createElement("li");
                li.className = "flex justify-between py-1 border-b border-slate-700";
                li.innerHTML = `<span class="text-blue-400 font-bold">${d.class}</span>
                                <span class="text-white font-bold">${conf}%</span>`;
                detectionList.appendChild(li);
            });

        } catch (err) {
            console.error(err);
            status.textContent = "NETWORK ERROR";
            status.className = "text-red-400 font-bold";
        }

        processing = false;
    }

    requestAnimationFrame(detectFrame);
}
