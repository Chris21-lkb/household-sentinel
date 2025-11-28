const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const detectionList = document.getElementById('detectionList');
const status = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const snakeOverlay = document.getElementById('snakeOverlay');
const snakeAlarm = document.getElementById('snakeAlarm');

let stream = null;
let processing = false;

function resizeCanvas() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
}

startBtn.addEventListener('click', async () => {
  stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  video.play();
  status.textContent = "Camera ON • Detecting...";
  status.className = "text-neon";
  startBtn.classList.add('hidden');
  stopBtn.classList.remove('hidden');
  video.onloadedmetadata = () => {
    resizeCanvas();
    detectFrame();
  };
});

stopBtn.addEventListener('click', () => {
  if (stream) stream.getTracks().forEach(t => t.stop());
  video.srcObject = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  detectionList.innerHTML = '';
  status.textContent = "Camera stopped";
  status.className = "text-gray-500";
  startBtn.classList.remove('hidden');
  stopBtn.classList.add('hidden');
  snakeOverlay.classList.add('hidden');
});

async function detectFrame() {
  if (!video.paused && !processing) {
    processing = true;
    resizeCanvas();
    
    const imageBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    const formData = new FormData();
    formData.append('file', imageBlob, 'frame.jpg');

    try {
      const response = await fetch('/detect', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      detectionList.innerHTML = '';
      let hasSnake = false;

      result.detections.forEach(d => {
        const [x1, y1, x2, y2] = d.box;
        const conf = (d.confidence * 100).toFixed(1);
        const label = `${d.class} ${conf}%`;

        ctx.strokeStyle = d.class === 'snake' ? '#ff0066' : '#00ffea';
        ctx.lineWidth = 4;
        ctx.strokeRect(x1, y1, x2-x1, y2-y1);
        ctx.fillStyle = d.class === 'snake' ? '#ff0066' : '#00ffea';
        ctx.font = '20px monospace';
        ctx.fillText(label, x1, y1 > 30 ? y1 - 10 : y1 + 25);

        const li = document.createElement('li');
        li.className = 'flex justify-between';
        li.innerHTML = `<span>${d.class}</span><span class="${d.class==='snake'?'text-danger':'text-neon'} font-bold">${conf}%</span>`;
        detectionList.appendChild(li);

        if (d.class === 'snake' && d.confidence > 0.5) {
          hasSnake = true;
        }
      });

      if (hasSnake) {
        snakeOverlay.classList.remove('hidden');
        document.body.classList.add('snake-alert');
        snakeAlarm.currentTime = 0;
        snakeAlarm.play();
      } else {
        snakeOverlay.classList.add('hidden');
        document.body.classList.remove('snake-alert');
        snakeAlarm.pause();
      }
    } catch (err) {
      console.error(err);
    }
    processing = false;
  }
  requestAnimationFrame(detectFrame);
}