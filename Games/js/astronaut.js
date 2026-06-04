// Astronaut Avatar & Face Capture Logic

let videoStream = null;
const userFaceImageKey = 'solar_astronaut_face';

function initAstronautCreator() {
    const modal = document.createElement('div');
    modal.id = 'astronaut-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.9); z-index: 10000;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        color: white; font-family: 'Montserrat', sans-serif;
    `;

    modal.innerHTML = `
        <h1 style="text-transform:uppercase; letter-spacing:5px; margin-bottom:20px;">Identity Verification</h1>
        <p style="margin-bottom:20px; color:#aaa;">Align your face with the helmet visor to proceed.</p>
        
        <div style="position:relative; width:320px; height:320px; border:2px solid #00f0ff; border-radius:20px; overflow:hidden; box-shadow:0 0 20px rgba(0,240,255,0.3);">
            <video id="webcam" autoplay playsinline style="width:100%; height:100%; object-fit:cover; transform:scaleX(-1);"></video>
            <div style="position:absolute; top:0; left:0; width:100%; height:100%; background:url('https://cdn-icons-png.flaticon.com/512/1995/1995470.png') no-repeat center; background-size:80%; opacity:0.3; pointer-events:none;"></div>
        </div>

        <canvas id="capture-canvas" width="320" height="320" style="display:none;"></canvas>

        <div style="margin-top:30px; display:flex; gap:20px;">
            <button id="capture-btn" style="padding:15px 30px; background:#00f0ff; color:black; border:none; border-radius:5px; font-weight:bold; cursor:pointer; text-transform:uppercase;">Capture ID</button>
            <button id="cancel-btn" style="padding:15px 30px; background:transparent; color:white; border:1px solid white; border-radius:5px; cursor:pointer; text-transform:uppercase;">Cancel</button>
        </div>
    `;

    document.body.appendChild(modal);

    const video = document.getElementById('webcam');

    // Start Camera
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                videoStream = stream;
                video.srcObject = stream;
            })
            .catch(err => {
                console.error("Camera Error:", err);
                alert("Camera access denied or unavailable. Please enable permissions.");
                closeAstronautCreator();
            });
    }

    document.getElementById('capture-btn').addEventListener('click', captureFace);
    document.getElementById('cancel-btn').addEventListener('click', closeAstronautCreator);
}

function captureFace() {
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('capture-canvas');
    const context = canvas.getContext('2d');

    // Draw video to canvas (captured frame)
    context.drawImage(video, 0, 0, 320, 320);

    // Save to LocalStorage
    try {
        const dataUrl = canvas.toDataURL('image/png');
        localStorage.setItem(userFaceImageKey, dataUrl);
        alert("Identity Verified: Welcome, Astronaut.");
        closeAstronautCreator();
        updateAstronautHUD(); // Apply face to HUD if visible
        updateProfileWidget(); // Update the main widget
    } catch (e) {
        console.error("Storage failed", e);
        alert("Could not save image (Storage Full?)");
    }
}

function closeAstronautCreator() {
    const modal = document.getElementById('astronaut-modal');
    if (modal) modal.remove();

    // Stop Stream
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
}

function createAstronautHUD() {
    // Check if HUD already exists
    if (document.getElementById('astronaut-hud')) return;

    const hud = document.createElement('div');
    hud.id = 'astronaut-hud';
    hud.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 500;
        display: none;
    `;

    // Helmet Vignette
    const vignette = document.createElement('div');
    vignette.style.cssText = `
        position: absolute; top:0; left:0; width:100%; height:100%;
        background: radial-gradient(circle, transparent 50%, black 140%);
        opacity: 0.6;
    `;
    hud.appendChild(vignette);

    // Face / ID Card in Corner
    const idCard = document.createElement('div');
    idCard.id = 'astronaut-id-card';
    idCard.style.cssText = `
        position: absolute; bottom: 20px; right: 20px;
        width: 100px; height: 130px; background: rgba(0,50,100,0.5);
        border: 1px solid #00f0ff; border-radius: 10px;
        display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
        padding-top: 10px; backdrop-filter: blur(5px);
    `;
    hud.appendChild(idCard);

    document.body.appendChild(hud);
    updateAstronautHUD();
}

function updateAstronautHUD() {
    const card = document.getElementById('astronaut-id-card');
    if (!card) return;

    // Get Face
    const faceData = localStorage.getItem(userFaceImageKey);
    const faceSrc = faceData ? faceData : 'https://cdn-icons-png.flaticon.com/512/3237/3237472.png'; // Default astronaut icon

    card.innerHTML = `
        <div style="width: 70px; height: 70px; border-radius: 50%; border: 2px solid white; overflow: hidden; background: black;">
            <img src="${faceSrc}" style="width:100%; height:100%; object-fit:cover;">
        </div>
        <div style="font-size: 10px; color: #00f0ff; margin-top: 5px; text-transform: uppercase;">Commander</div>
        <div style="font-size: 8px; color: white;">Online</div>
    `;
}

// Show HUD only in Surface Mode
function toggleAstronautHUD(show) {
    const hud = document.getElementById('astronaut-hud');
    if (hud) hud.style.display = show ? 'block' : 'none';
}

// Initialize Profile Widget on load
document.addEventListener('DOMContentLoaded', () => {
    createProfileWidget();
});

function createProfileWidget() {
    // Check if widget already exists
    if (document.getElementById('profile-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'profile-widget';
    widget.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 4000;
        display: flex; align-items: center; gap: 10px;
        cursor: pointer;
        transition: transform 0.2s, filter 0.2s;
    `;
    widget.title = "Click to Update Profile Photo";

    // Hover Effects
    widget.onmouseenter = () => {
        widget.style.transform = "scale(1.05)";
        widget.style.filter = "drop-shadow(0 0 5px #00f0ff)";
    };
    widget.onmouseleave = () => {
        widget.style.transform = "scale(1)";
        widget.style.filter = "none";
    };

    // Create Avatar Container
    const avatar = document.createElement('div');
    avatar.id = 'profile-avatar';
    avatar.style.cssText = `
        width: 50px; height: 50px; 
        border: 2px solid #00f0ff; 
        background: black;
        overflow: hidden;
        box-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
    `;

    // Initial Image Load
    const faceData = localStorage.getItem(userFaceImageKey);
    const faceSrc = faceData ? faceData : 'https://cdn-icons-png.flaticon.com/512/3237/3237472.png';

    avatar.innerHTML = `<img id="profile-img" src="${faceSrc}" style="width:100%; height:100%; object-fit:cover;">`;

    // Label (Optional, keeping it clean as per request for "small square")
    const label = document.createElement('div');
    label.style.cssText = `
        color: white; font-family: 'Montserrat', sans-serif; font-size: 10px; text-transform: uppercase;
        text-shadow: 0 0 5px #00f0ff;
    `;
    label.innerText = "COMMANDER";

    widget.appendChild(label); // Left of avatar
    widget.appendChild(avatar); // Right side

    document.body.appendChild(widget);

    // Click to Open Creator
    widget.addEventListener('click', initAstronautCreator);
}

// Update the widget specifically
function updateProfileWidget() {
    const img = document.getElementById('profile-img');
    if (img) {
        const faceData = localStorage.getItem(userFaceImageKey);
        if (faceData) img.src = faceData;
    }
}

// Hook into state changes
const _originalStartSurface = window.startSurfaceExploration;
window.startSurfaceExploration = function (planetName) {
    _originalStartSurface(planetName);
    toggleAstronautHUD(true);
}

const _originalReturnSolar = window.returnToSolarSystem;
window.returnToSolarSystem = function () {
    _originalReturnSolar();
    toggleAstronautHUD(false);
}

const _originalReturnOrbit = window.returnToOrbit;
window.returnToOrbit = function () {
    _originalReturnOrbit();
    toggleAstronautHUD(false); // Maybe keep it off in satellite view? Or on? Let's keep off for clarity.
}

window.initAstronautCreator = initAstronautCreator;
