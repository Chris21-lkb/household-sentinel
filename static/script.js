// static/script.js — FINAL COMPLETE AND CORRECTED VERSION
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const detectionList = document.getElementById('detectionList');
const status = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const alertOverlay = document.getElementById('alertOverlay'); 
const snakeAlarm = document.getElementById('snakeAlarm');

// New elements for visual effects
const videoContainer = document.getElementById('videoContainer'); 
const scannerEffect = document.getElementById('scanner-effect');

let stream = null;
let processing = false;

function resizeCanvas() {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
}

startBtn.addEventListener('click', async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.play();
        status.textContent = "ACTIVATED • Processing Frames";
        status.className = "text-primary font-bold animate-pulse";
        startBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
        document.body.classList.remove('alert-active'); 
        videoContainer.classList.add('shadow-glow-primary');

        // Initial message cleared
        detectionList.innerHTML = ''; 

        video.onloadedmetadata = () => {
            resizeCanvas();
            detectFrame();
        };
    } catch (error) {
        console.error("Error accessing camera:", error);
        status.textContent = "ERROR: CAMERA ACCESS DENIED";
        status.className = "text-secondary font-bold";
    }
});

stopBtn.addEventListener('click', () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    detectionList.innerHTML = '<li class="text-slate-500 py-2">System awaiting activation...</li>';
    status.textContent = "Offline";
    status.className = "text-green-500 font-bold";
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    
    // Deactivate alarm visuals
    alertOverlay.classList.add('hidden');
    document.body.classList.remove('alert-active'); 
    videoContainer.classList.remove('shadow-glow-primary', 'shadow-glow-secondary', 'border-secondary/50');
    videoContainer.classList.add('border-primary/50');
    scannerEffect.classList.remove('border-secondary/20', 'shadow-glow-secondary/50');
    scannerEffect.classList.add('border-primary/20', 'shadow-glow-primary/50');
    
    // Stop audio
    snakeAlarm.pause();
    snakeAlarm.currentTime = 0;
});

async function detectFrame() {
    if (!video.paused && !processing) {
        processing = true;
        resizeCanvas();

        // 1A. Draw video content to canvas (for toBlob conversion)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height); 

        // 1B. Prepare frame for server
        const imageBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
        const formData = new FormData();
        formData.append('file', imageBlob, 'frame.jpg');

        let isAlarmClassDetected = false;
        // Set the class you want to trigger the alarm (e.g., 'sofa', 'laptop', 'tv')
        const ALARM_CLASS = 'sofa'; 

        try {
            const response = await fetch('/detect', { method: 'POST', body: formData });
            const result = await response.json();

            // --- CRITICAL DRAWING FIX ---
            // 2A. Clear the entire canvas (removes old boxes and video image)
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // 2B. REDRAW THE CURRENT VIDEO FRAME! (This is the fix for the bounding box issue)
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            // -----------------------------

            detectionList.innerHTML = '';

            // 3. Process detections and draw boxes
            result.detections.forEach(d => {
                const [x1, y1, x2, y2] = d.box;
                const confPercent = (d.confidence * 100).toFixed(1);
                const isCurrentItemAlarm = d.class.toLowerCase() === ALARM_CLASS;

                if (isCurrentItemAlarm) { 
                    isAlarmClassDetected = true;
                }

                // --- Drawing Bounding Box and Label ---
                const color = isCurrentItemAlarm ? '#FF3F6B' : '#00D1FF'; // Secondary (Red) or Primary (Blue)
                
                // Box
                ctx.strokeStyle = color;
                ctx.lineWidth = 4;
                ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

                // Background behind text
                ctx.fillStyle = color;
                const text = `${d.class} ${confPercent}%`;
                ctx.font = 'bold 20px monospace';
                const textMetrics = ctx.measureText(text);
                const textHeight = 25; 
                const yPos = y1 > textHeight ? y1 - textHeight : y1 + 10;
                
                ctx.fillRect(x1, yPos, textMetrics.width + 10, textHeight);

                // Text
                ctx.fillStyle = '#0F172A'; // Dark background color for text
                ctx.fillText(text, x1 + 5, yPos + 18);

                // --- Detection List Update ---
                const li = document.createElement('li');
                
                li.className = isCurrentItemAlarm ? 
                    'flex justify-between items-center py-2 px-1 alert-item border-b border-secondary/50' : 
                    'flex justify-between items-center py-2 px-1 border-b border-slate-700';

                const nameClass = isCurrentItemAlarm ? 'text-secondary text-xl font-medium' : 'text-primary text-xl font-medium';
                const confClass = isCurrentItemAlarm ? 'text-secondary font-extrabold text-xl' : 'text-white font-extrabold text-xl';

                li.innerHTML = `<span class="${nameClass}">${d.class}</span><span class="${confClass}">${confPercent}%</span>`;
                detectionList.appendChild(li);
            });

            // 4. ACTIVATE/DEACTIVATE SYSTEM ALARM
            if (isAlarmClassDetected) {
                alertOverlay.classList.remove('hidden');
                document.body.classList.add('alert-active');
                videoContainer.classList.remove('border-primary/50', 'shadow-glow-primary');
                videoContainer.classList.add('border-secondary/50', 'shadow-glow-secondary');
                scannerEffect.classList.remove('border-primary/20', 'shadow-glow-primary/50');
                scannerEffect.classList.add('border-secondary/20', 'shadow-glow-secondary/50');
                
                snakeAlarm.play().catch(e => console.log("Audio play failed:", e)); 
            } else {
                alertOverlay.classList.add('hidden');
                document.body.classList.remove('alert-active');
                videoContainer.classList.remove('border-secondary/50', 'shadow-glow-secondary');
                videoContainer.classList.add('border-primary/50', 'shadow-glow-primary');
                scannerEffect.classList.remove('border-secondary/20', 'shadow-glow-secondary/50');
                scannerEffect.classList.add('border-primary/20', 'shadow-glow-primary/50');

                snakeAlarm.pause();
                snakeAlarm.currentTime = 0;
            }

        } catch (err) {
            console.error("Error:", err);
            status.textContent = "NETWORK ERROR: Could not reach detection server.";
            status.className = "text-secondary font-bold";
        }

        processing = false;
    }
    requestAnimationFrame(detectFrame);
}