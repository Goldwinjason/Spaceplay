// Satellite View Logic (Orbit View) using Three.js

let satScene, satCamera, satRenderer, satAnimationId;
let satPlanetMesh, satAtmosphereMesh;
let satSatellitePivot; // Pivot for orbiting satellite
let satControls;

function initSatelliteView(planetName) {
    const container = document.getElementById('satellite-view');
    container.innerHTML = '';
    satSatellitePivot = null; // Reset pivot

    const config = window.PlanetConfig[planetName];
    if (!config) {
        console.error("No config for", planetName);
        return;
    }

    document.getElementById('satellite-planet-name').innerText = planetName;

    // Update LAND button text
    const landBtn = document.getElementById('satellite-land-btn');
    if (landBtn) {
        landBtn.innerHTML = `LAND ON ${planetName.toUpperCase()} 🚀`;
        landBtn.style.display = 'inline-block';
    }
    const attackBtn = document.getElementById('satellite-attack-btn');
    if (attackBtn) {
        attackBtn.innerText = 'ATTACK ON PLANET';
        attackBtn.style.display = 'inline-block';
    }

    // AR is only available on the main solar-system page.
    const arBtn = document.getElementById('satellite-ar-btn');
    if (arBtn) {
        arBtn.style.display = 'none';
    }

    // Satellite AR is also hidden outside the main page.
    const satArBtn = document.getElementById('satellite-sat-ar-btn');
    if (satArBtn) {
        satArBtn.style.display = 'none';
    }

    // 1. Scene
    satScene = new THREE.Scene();
    satScene.background = new THREE.Color(0x000000);

    // Add stars background (reuse similar logic from surface or simpler)
    addStarField(satScene);

    // 2. Camera
    satCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    satCamera.position.z = 5; // Distance from planet

    // 3. Renderer
    satRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    satRenderer.setSize(window.innerWidth, window.innerHeight);
    satRenderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(satRenderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0x888888); // Increased brightness
    satScene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(5, 3, 5);
    satScene.add(sunLight);

    // 5. Planet Mesh
    // 5. Planet Mesh

    // Check if we have a custom 3D model for this planet (MARS or EARTH)
    if (planetName === 'Mars' || planetName === 'Earth') {
        console.log(`Attempting to load ${planetName} model...`);
        const loader = new THREE.GLTFLoader();

        let modelPath = '';
        if (planetName === 'Mars') modelPath = 'models/24881_Mars_1_6792.glb';
        if (planetName === 'Earth') modelPath = 'models/Earth_1_12756 (1).glb';

        loader.load(modelPath, (gltf) => {
            console.log(`${planetName} model loaded successfully!`, gltf);
            satPlanetMesh = gltf.scene;

            // Auto-scale to fit size ~3 units (radius 1.5)
            const box = new THREE.Box3().setFromObject(satPlanetMesh);
            const size = new THREE.Vector3();
            box.getSize(size);
            console.log("Original Model Size:", size);

            const maxDim = Math.max(size.x, size.y, size.z);
            let scaleFactor = 1;

            if (maxDim > 0) {
                scaleFactor = 3.0 / maxDim; // Target diameter ~3
            } else {
                console.warn("Model has 0 size, using default scale 0.01");
                scaleFactor = 0.01;
            }

            console.log("Applying Scale Factor:", scaleFactor);
            satPlanetMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
            satPlanetMesh.position.set(0, 0, 0); // Center it

            satScene.add(satPlanetMesh);

            // Add specific bright lights for the model
            const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
            satScene.add(ambientLight);

            const dirLight = new THREE.DirectionalLight(0xffffff, 3.0);
            dirLight.position.set(5, 5, 5);
            satScene.add(dirLight);

            // Optional: Hide atmosphere mesh if model has its own or if it doesn't fit well
            if (satAtmosphereMesh) satAtmosphereMesh.visible = false;

            // Force render
            satRenderer.render(satScene, satCamera);

        }, (xhr) => {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        }, (error) => {
            console.error(`An error happened loading ${planetName} model:`, error);
            alert(`Error loading ${planetName} model! Check console for details.`);
            // Fallback to sphere if error
            createSpherePlanet(config);
        });

        // --- Load Orbiting Satellite (Earth Only) ---
        if (planetName === 'Earth') {
            console.log("Loading AcrimSAT for Earth...");
            const satLoader = new THREE.GLTFLoader();
            // Create a pivot group for orbit
            satSatellitePivot = new THREE.Group();
            satScene.add(satSatellitePivot);

            satLoader.load('models/Active Cavity Irradiance Monitor Satellite (AcrimSAT) (B).glb', (gltf) => {
                const satModel = gltf.scene;
                console.log("Satellite loaded:", satModel);

                // Scale Logic for Satellite
                const box = new THREE.Box3().setFromObject(satModel);
                const size = new THREE.Vector3();
                box.getSize(size);
                const maxDim = Math.max(size.x, size.y, size.z);
                let scaleFactor = 0.2; // Default small size
                if (maxDim > 0) {
                    scaleFactor = 0.5 / maxDim; // Target size 0.5
                }
                satModel.scale.set(scaleFactor, scaleFactor, scaleFactor);

                // Position offset from center (Orbit radius)
                satModel.position.set(3.5, 0.5, 0);

                // Add to pivot
                satSatellitePivot.add(satModel);

            }, undefined, (error) => {
                console.error("Error loading Satellite:", error);
            });
        }
    } else {
        createSpherePlanet(config);
    }

    function createSpherePlanet(config) {
        const geometry = new THREE.SphereGeometry(1.5, 64, 64);
        const textureLoader = new THREE.TextureLoader();

        // Load texture from config
        const textureUrl = config.textures.satellite;

        // Create material with base color immediately
        const material = new THREE.MeshStandardMaterial({
            color: config.colors.base || 0xffffff,
            roughness: 0.8,
            metalness: 0.1
        });

        satPlanetMesh = new THREE.Mesh(geometry, material);
        satScene.add(satPlanetMesh);

        // Apply texture asynchronously
        textureLoader.load(textureUrl,
            (texture) => {
                satPlanetMesh.material.map = texture;
                satPlanetMesh.material.needsUpdate = true;
                if (satRenderer) satRenderer.render(satScene, satCamera);
            },
            undefined,
            (err) => { console.error("Error loading texture:", err); }
        );
    }

    // 6. Atmosphere Glow (Simple)
    if (config.colors.atmosphere) {
        const atmoGeo = new THREE.SphereGeometry(1.55, 64, 64);
        const atmoMat = new THREE.MeshBasicMaterial({
            color: config.colors.atmosphere,
            transparent: true,
            opacity: 0.2,
            side: THREE.BackSide
        });
        satAtmosphereMesh = new THREE.Mesh(atmoGeo, atmoMat);
        satScene.add(satAtmosphereMesh);
    }

    // 7. Controls (Orbit)
    // We included OrbitControls in index.html
    if (typeof THREE.OrbitControls !== 'undefined') {
        satControls = new THREE.OrbitControls(satCamera, satRenderer.domElement);
        satControls.enableDamping = true;
        satControls.dampingFactor = 0.05;
        satControls.autoRotate = true;
        satControls.autoRotateSpeed = 0.5;
        satControls.enablePan = false;
        satControls.minDistance = 2.5;
        satControls.maxDistance = 10;
    }

    // 8. Animation Loop
    window.addEventListener('resize', onSatWindowResize, false);
    animateSatellite();
}

function addStarField(scene) {
    const starGeo = new THREE.BufferGeometry();
    const starCount = 5000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
        starPos[i] = (Math.random() - 0.5) * 200;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);
}

function animateSatellite() {
    satAnimationId = requestAnimationFrame(animateSatellite);

    if (satControls) {
        satControls.update();
    } else if (satPlanetMesh) {
        // Fallback rotation if no controls
        satPlanetMesh.rotation.y += 0.001;
    }

    // Animate Satellite Orbit
    if (satSatellitePivot) {
        satSatellitePivot.rotation.y += 0.005; // Orbit speed
        // Optional: Rotate satellite itself if needed
        // satSatellitePivot.children.forEach(child => child.rotation.y += 0.01);
    }

    satRenderer.render(satScene, satCamera);
}

function onSatWindowResize() {
    if (!satCamera || !satRenderer) return;
    satCamera.aspect = window.innerWidth / window.innerHeight;
    satCamera.updateProjectionMatrix();
    satRenderer.setSize(window.innerWidth, window.innerHeight);
}

window.stopSatelliteView = function () {
    if (satAnimationId) cancelAnimationFrame(satAnimationId);
    window.removeEventListener('resize', onSatWindowResize);
    // Cleanup if needed
};

window.initSatelliteView = initSatelliteView;

// --- ATTACK MISSION LOGIC ---
window.initSatelliteView = initSatelliteView;

// --- ATTACK MISSION LOGIC ---

// 1. Mission Configuration
window.openMissionModal = function () {
    document.getElementById('mission-modal').style.display = 'block';

    // Disable inputs behind modal
    const landBtn = document.getElementById('satellite-land-btn');
    const attackBtn = document.getElementById('satellite-attack-btn');
    if (landBtn) landBtn.style.pointerEvents = 'none';
    if (attackBtn) attackBtn.style.pointerEvents = 'none';
};

window.closeMissionModal = function () {
    document.getElementById('mission-modal').style.display = 'none';

    // Re-enable inputs
    const landBtn = document.getElementById('satellite-land-btn');
    const attackBtn = document.getElementById('satellite-attack-btn');
    if (landBtn) landBtn.style.pointerEvents = 'auto';
    if (attackBtn) attackBtn.style.pointerEvents = 'auto';
};

window.confirmMission = function () {
    const targetPlanet = document.getElementById('target-planet-select').value;
    const rivalName = document.getElementById('rival-name-input').value || "THE ENEMY";

    // Validate target
    if (!window.PlanetConfig[targetPlanet]) {
        alert("Invalid Target System!");
        return;
    }

    closeMissionModal();

    // Trigger Warp Sequence
    initiateWarpToTarget(targetPlanet, rivalName);
};

// 2. Warp Sequence
function initiateWarpToTarget(planetName, rivalName) {
    console.log(`Warping to ${planetName} to attack ${rivalName}...`);

    // Fast switch to the target planet (Satellite View)
    window.enterSatelliteView(planetName);

    // Simulate "arriving" delay
    setTimeout(() => {
        executeAttackSequence(planetName, rivalName);
    }, 1500);
}

// 3. Attack Sequence (Enhanced Visuals)
function executeAttackSequence(planetName, rivalName) {
    console.log("Weapons Free!");

    // Hide UI during attack
    const landBtn = document.getElementById('satellite-land-btn');
    const attackBtn = document.getElementById('satellite-attack-btn');
    if (landBtn) landBtn.style.display = 'none';
    if (attackBtn) attackBtn.style.display = 'none';

    const startPos = satCamera.position.clone();
    startPos.x += 2;
    startPos.y -= 1.5;
    startPos.z += 1; // Move forward a bit to ensure visibility

    const targetPos = new THREE.Vector3(0, 0, 0); // Planet Center
    const distance = startPos.distanceTo(targetPos);

    // --- Visual 1: Dual Layer Laser ---

    // Core Beam (White, Thin)
    const coreGeo = new THREE.CylinderGeometry(0.02, 0.02, distance, 8);
    coreGeo.rotateX(-Math.PI / 2);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const laserCore = new THREE.Mesh(coreGeo, coreMat);

    // Glow Beam (Red, Thick, Transparent)
    const glowGeo = new THREE.CylinderGeometry(0.15, 0.15, distance, 8);
    glowGeo.rotateX(-Math.PI / 2);
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending
    });
    const laserGlow = new THREE.Mesh(glowGeo, glowMat);

    // Position Group
    const midpoint = new THREE.Vector3().addVectors(startPos, targetPos).multiplyScalar(0.5);
    const laserGroup = new THREE.Group();
    laserGroup.add(laserCore);
    laserGroup.add(laserGlow);
    laserGroup.position.copy(midpoint);
    laserGroup.lookAt(targetPos);

    satScene.add(laserGroup);

    // --- Animate Laser ---
    let frame = 0;
    const attackInterval = setInterval(() => {
        frame++;

        // Pulse Glow
        laserGlow.material.opacity = 0.4 + Math.sin(frame * 0.5) * 0.2;
        laserGlow.scale.x = 1 + Math.sin(frame * 0.8) * 0.2;
        laserGlow.scale.z = 1 + Math.sin(frame * 0.8) * 0.2;

        // Camera Shake
        satCamera.position.x += (Math.random() - 0.5) * 0.05;
        satCamera.position.y += (Math.random() - 0.5) * 0.05;

        if (frame > 40) { // ~2 seconds
            clearInterval(attackInterval);
            satScene.remove(laserGroup);
            triggerImpactEffects(targetPos, planetName, rivalName);
        }
    }, 30);
}

function triggerImpactEffects(position, planetName, rivalName) {
    // --- Visual 2: Particle Explosion ---
    const particles = 100;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];

    for (let i = 0; i < particles; i++) {
        positions.push(position.x, position.y, position.z + 1.2); // Surface impact side
        velocities.push(
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3
        );
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
        color: 0xffaa00,
        size: 0.2,
        transparent: true,
        blending: THREE.AdditiveBlending
    });

    const particleSystem = new THREE.Points(geometry, material);
    satScene.add(particleSystem);

    // --- Visual 3: Screen Flash ---
    const flashOverlay = document.getElementById('flash-overlay');
    if (flashOverlay) {
        flashOverlay.style.display = 'block';
        // Force reflow
        void flashOverlay.offsetWidth;
        flashOverlay.style.opacity = 0.8;

        setTimeout(() => {
            flashOverlay.style.opacity = 0;
            setTimeout(() => { flashOverlay.style.display = 'none'; }, 200);
        }, 100);
    }

    // --- Animate Particles ---
    let pFrame = 0;
    const boomInterval = setInterval(() => {
        pFrame++;
        const positions = particleSystem.geometry.attributes.position.array;

        for (let i = 0; i < particles; i++) {
            positions[i * 3] += velocities[i * 3];
            positions[i * 3 + 1] += velocities[i * 3 + 1];
            positions[i * 3 + 2] += velocities[i * 3 + 2];
        }
        particleSystem.geometry.attributes.position.needsUpdate = true;
        material.opacity -= 0.02;

        if (material.opacity <= 0) {
            clearInterval(boomInterval);
            satScene.remove(particleSystem);
            showMissionResult(planetName, rivalName);
        }
    }, 30);
}

function showMissionResult(planetName, rivalName) {
    const msg = document.getElementById('mission-complete-msg');
    const textEl = document.getElementById('mission-result-text');

    if (msg && textEl) {
        textEl.innerHTML = `NEUTRALIZED<br><span style="color:white; font-size:30px;">${rivalName}'s ${planetName}</span>`;
        msg.style.display = 'block';

        setTimeout(() => {
            msg.style.display = 'none';
            // Restore buttons
            const landBtn = document.getElementById('satellite-land-btn');
            const attackBtn = document.getElementById('satellite-attack-btn');
            if (landBtn) landBtn.style.display = 'inline-block';
            if (attackBtn) attackBtn.style.display = 'inline-block';
        }, 4000);
    }
}

