// Planet Surface Logic using Three.js and custom Third-Person Controls

let scene, camera, renderer, animationId;
let player; // Astronaut Group
let cameraOffset;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let playerVelocity, playerDirection;

// Hotspot System
let hotspots = [];
let currentTerrainMesh = null;
let obstacles = []; // Array to store collision objects {x, z, r}
let activeTurrets = []; // Array to store spawned turrets for tracking
const INTERACTION_DISTANCE = 8;

// Returns corrected position {x, z} if collision occurs, otherwise returns input
function resolveCollision(x, z) {
    const playerRadius = 0.5;
    let newX = x;
    let newZ = z;

    for (let obs of obstacles) {
        const dx = newX - obs.x;
        const dz = newZ - obs.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const minDist = obs.r + playerRadius;

        if (dist < minDist) {
            // Collision! Push player out along the normal vector
            // This creates the "sliding" effect
            const angle = Math.atan2(dz, dx);
            const pushX = Math.cos(angle) * minDist;
            const pushZ = Math.sin(angle) * minDist;

            newX = obs.x + pushX;
            newZ = obs.z + pushZ;
        }
    }
    return { x: newX, z: newZ };
}

function initPlanetSurface(planetName) {
    console.log("Initializing Surface for:", planetName);
    const container = document.getElementById('surface-view');
    container.innerHTML = '';
    currentTerrainMesh = null;
    obstacles = [];
    activeTurrets = [];

    const config = window.PlanetConfig[planetName];
    if (!config) {
        console.error("Unknown planet for surface:", planetName);
        return;
    }

    updateHUD(planetName, config);

    // --- DEFENSE MECHANISM (ALL PLANETS) ---
    createDefenseButton();

    // 1. Setup Scene
    scene = new THREE.Scene();
    const fogColor = config.colors.fog || 0x000000;
    scene.fog = new THREE.FogExp2(fogColor, 0.02);
    scene.background = new THREE.Color(fogColor);

    // 2. Setup Camera
    // Bring camera CLOSER for a better look
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    cameraOffset = new THREE.Vector3(0, 3, 6); // (x, y, z) relative to player

    // 3. Setup Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 4. Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(20, 50, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // 5. Environment
    createPlanetEnvironment(planetName, config);

    // 6. Create Astronaut
    try {
        createAstronaut();
    } catch (e) {
        console.error("Error creating astronaut:", e);
    }

    // 7. Inputs
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    createMobileMoveControls();

    // 8. Load Hotspots
    loadHotspots(planetName);

    // 9. Loop
    window.addEventListener('resize', onWindowResize, false);
    animate();
}

function createAstronaut() {
    console.log("Creating Astronaut Model...");
    player = new THREE.Group();

    // --- Materials ---
    const suitWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const suitGreyMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.8 });
    const jointMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
    // Simple Glass
    const visorGlassMat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.1,
        metalness: 0.8,
        transparent: true,
        opacity: 0.4
    });

    // --- Face Texture ---
    const faceData = localStorage.getItem('solar_astronaut_face');
    let faceMesh = null;

    if (faceData) {
        console.log("Face Data found, applying texture.");
        const loader = new THREE.TextureLoader();
        loader.load(faceData, (texture) => {
            // Texture loaded successfully
            const faceMat = new THREE.MeshBasicMaterial({ map: texture });
            // Create face plane
            faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5), faceMat);
            faceMesh.position.set(0, 0, 0.2);

            // Add to helmet if helmet group exists (async issue handling)
            if (player) {
                const headGroup = player.getObjectByName("helmetGroup");
                if (headGroup) {
                    headGroup.add(faceMesh);
                    console.log("Face added to helmet");
                }
            }
        }, undefined, (err) => {
            console.error("Error loading face texture", err);
        });
    }

    // --- Geometry ---

    // 1. Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.4), suitWhiteMat);
    torso.position.y = 1.35;
    torso.castShadow = true;
    player.add(torso);

    const chestBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.15), jointMat);
    chestBox.position.set(0, 1.45, 0.25);
    player.add(chestBox);

    // Waist
    const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 12), jointMat);
    waist.position.y = 0.95;
    player.add(waist);

    const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.25, 12), suitWhiteMat);
    hips.position.y = 0.75;
    player.add(hips);

    // 2. Head / Helmet
    const helmetGroup = new THREE.Group();
    helmetGroup.name = "helmetGroup";
    helmetGroup.position.y = 1.85;
    player.add(helmetGroup);

    // White Shell
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.35, 32, 32), suitWhiteMat);
    helmetGroup.add(helmet);

    // Glass Visor (Larger Sphere)
    const glassSphere = new THREE.Mesh(new THREE.SphereGeometry(0.37, 32, 32), visorGlassMat);
    helmetGroup.add(glassSphere);

    // Side details
    const earGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 8);
    const earL = new THREE.Mesh(earGeo, jointMat);
    earL.rotation.z = Math.PI / 2;
    earL.position.set(-0.35, 0, 0);
    helmetGroup.add(earL);
    const earR = new THREE.Mesh(earGeo, jointMat);
    earR.rotation.z = Math.PI / 2;
    earR.position.set(0.35, 0, 0);
    helmetGroup.add(earR);

    // 3. Backpack
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.3), suitWhiteMat);
    backpack.position.set(0, 1.4, -0.35);
    player.add(backpack);

    // 4. Arms
    const shoulderGeo = new THREE.SphereGeometry(0.18);
    const armGeo = new THREE.CylinderGeometry(0.12, 0.10, 0.5);

    // Left
    const shoulderL = new THREE.Mesh(shoulderGeo, suitWhiteMat);
    shoulderL.position.set(-0.45, 1.6, 0);
    player.add(shoulderL);

    const armL = new THREE.Mesh(armGeo, suitWhiteMat);
    armL.position.set(-0.55, 1.35, 0);
    armL.rotation.z = 0.2;
    player.add(armL);

    const handL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.1), jointMat);
    handL.position.set(-0.6, 1.05, 0);
    player.add(handL);

    // Right
    const shoulderR = new THREE.Mesh(shoulderGeo, suitWhiteMat);
    shoulderR.position.set(0.45, 1.6, 0);
    player.add(shoulderR);

    const armR = new THREE.Mesh(armGeo, suitWhiteMat);
    armR.position.set(0.55, 1.35, 0);
    armR.rotation.z = -0.2;
    player.add(armR);

    const handR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.1), jointMat);
    handR.position.set(0.6, 1.05, 0);
    player.add(handR);

    // 5. Legs
    const legGeo = new THREE.CylinderGeometry(0.18, 0.15, 0.6);

    const legL = new THREE.Mesh(legGeo, suitWhiteMat);
    legL.position.set(-0.2, 0.45, 0);
    player.add(legL);

    const legR = new THREE.Mesh(legGeo, suitWhiteMat);
    legR.position.set(0.2, 0.45, 0);
    player.add(legR);

    // Boots
    const bootGeo = new THREE.BoxGeometry(0.2, 0.15, 0.3);
    const bootL = new THREE.Mesh(bootGeo, suitGreyMat);
    bootL.position.set(-0.2, 0.075, 0.05);
    player.add(bootL);
    const bootR = new THREE.Mesh(bootGeo, suitGreyMat);
    bootR.position.set(0.2, 0.075, 0.05);
    player.add(bootR);

    player.position.set(0, 0, 0);
    scene.add(player);
    console.log("Astronaut added to scene at 0,0,0");
}


function updateHUD(planetName, config) {
    document.getElementById('hud-planet-name').innerText = planetName;
    document.getElementById('hud-temp').innerText = config.temp;
    document.getElementById('hud-o2').innerText = config.o2;
    document.getElementById('hud-o2').style.color = config.o2 === 'NONE' || config.o2 === 'TOXIC' ? 'red' : '#00f0ff';
    document.getElementById('hud-gravity').innerText = config.gravity;
}

function createPlanetEnvironment(planetName, config) {
    // Custom Environment for Mars
    if (planetName === 'Mars') {
        createMarsTerrain(config);
        return;
    }

    // Custom Environment for Earth
    if (planetName === 'Earth') {
        createEarthTerrain(config);
        return;
    }

    // Custom Environment for Moon
    if (planetName === 'Moon') {
        createMoonTerrain(config);
        return;
    }

    let groundColor = config.colors.ground || 0x888888;
    const floorGeometry = new THREE.PlaneGeometry(2000, 2000, 100, 100);
    floorGeometry.rotateX(-Math.PI / 2);

    const vertices = floorGeometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const z = vertices[i + 2];
        // Deterministic noise for generic planets
        let y = Math.sin(x / 10) * 0.5 + Math.cos(z / 10) * 0.5 + 1.0;
        vertices[i + 1] = y;
    }

    const floorMaterial = new THREE.MeshStandardMaterial({
        color: groundColor,
        roughness: 0.9,
        flatShading: true
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.receiveShadow = true;
    scene.add(floor);
    currentTerrainMesh = floor;

    // Environment Rocks (Generic)
    const boxGeo = new THREE.DodecahedronGeometry(1, 0);
    const boxMat = new THREE.MeshStandardMaterial({ color: groundColor, flatShading: true });
    for (let i = 0; i < 50; i++) {
        const rock = new THREE.Mesh(boxGeo, boxMat);
        // Avoid center where player is
        let x = Math.floor(Math.random() * 80 - 40);
        let z = Math.floor(Math.random() * 80 - 40);
        if (Math.abs(x) < 2) x += 5;
        if (Math.abs(z) < 2) z += 5;

        // Calculate Y deterministically
        let y = Math.sin(x / 10) * 0.5 + Math.cos(z / 10) * 0.5 + 1.0;

        rock.position.x = x;
        rock.position.y = y + 0.3; // Slight embed
        rock.position.z = z;
        const s = 1 + Math.random() * 3;
        rock.scale.set(s, s, s);
        rock.rotation.y = Math.random() * Math.PI;
        scene.add(rock);

        obstacles.push({ x: x, z: z, r: s }); // Radius approx s
    }
}

function createMarsTerrain(config) {
    console.log("Generating Mars Terrain...");

    // 1. denser Fog for Mars
    scene.fog = new THREE.FogExp2(0xc68b77, 0.04);
    scene.background = new THREE.Color(0xc68b77);

    // 2. Rugged Terrain Geometry
    // More segments for smoother hills
    const floorGeometry = new THREE.PlaneGeometry(1000, 1000, 128, 128);
    floorGeometry.rotateX(-Math.PI / 2);

    const vertices = floorGeometry.attributes.position.array;

    // Simple Noise Function for Hills
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const z = vertices[i + 2];

        // Combine sine waves for dunes/hills
        let y = Math.sin(x / 20) * 2 + Math.cos(z / 25) * 2;
        y += Math.sin(x / 5) * 0.5 + Math.cos(z / 5) * 0.5; // Detail
        // REMOVED Random noise for determinism

        // Flatten center slightly for landing area
        if (Math.abs(x) < 10 && Math.abs(z) < 10) {
            y *= 0.2;
        }

        vertices[i + 1] = y;
    }

    floorGeometry.computeVertexNormals();

    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0xc1440e, // Martian Red
        roughness: 1,
        metalness: 0,
        flatShading: true
    });

    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.receiveShadow = true;
    scene.add(floor);
    currentTerrainMesh = floor;

    // 3. Martian Rocks
    const rockGeo = new THREE.DodecahedronGeometry(1, 1); // More detailed rocks
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8d320a, flatShading: true });

    for (let i = 0; i < 150; i++) {
        const rock = new THREE.Mesh(rockGeo, rockMat);

        // Random Pos
        let x = (Math.random() - 0.5) * 100;
        let z = (Math.random() - 0.5) * 100;

        // Clear center
        if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;

        // Calculate Y (height) exactly as per terrain
        let y = Math.sin(x / 20) * 2 + Math.cos(z / 25) * 2;
        y += Math.sin(x / 5) * 0.5 + Math.cos(z / 5) * 0.5;

        rock.position.set(x, y + 0.3, z); // +0.3 to embed slightly (radius ~1)

        const s = 0.5 + Math.random() * 1.5;
        scene.add(rock);
        obstacles.push({ x: x, z: z, r: s });
    }

    // 4. Mars Rovers (Satellites/Rovers)
}

function createMoonTerrain(config) {
    console.log("Generating Moon Terrain with Apollo 17 Site...");

    // 1. Black Sky / No Atmosphere
    scene.fog = new THREE.FogExp2(0x000000, 0.002);
    scene.background = new THREE.Color(0x000000);

    // 2. Load STL Model
    const loader = new THREE.STLLoader();
    loader.load('models/Apollo 17 - Landing Site.stl', function (geometry) {

        console.log("Apollo 17 STL Loaded!");
        // Center geometry
        geometry.center();

        const material = new THREE.MeshPhongMaterial({
            color: 0xdddddd, // Soft White/Grey
            flatShading: false,
            shininess: 0
        });

        const mesh = new THREE.Mesh(geometry, material);

        // Scale it up to act as a proper environment
        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox;
        const sizeX = bbox.max.x - bbox.min.x;
        const sizeY = bbox.max.y - bbox.min.y;
        const sizeZ = bbox.max.z - bbox.min.z;
        const maxDim = Math.max(sizeX, sizeY, sizeZ);

        console.log("Original STL Size:", sizeX, sizeY, sizeZ);

        const targetSize = 2500;
        let s = targetSize / maxDim;

        if (!isFinite(s) || s === 0) s = 1.0;

        console.log("Scaling STL by:", s);
        mesh.scale.set(s, s, s);

        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = -2; // Drop it slightly

        scene.add(mesh);

        // Set walk mesh area
        currentTerrainMesh = mesh;

    }, (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    }, (error) => {
        console.error("Error loading STL:", error);
        // Fallback to procedural
        alert("Error loading Apollo 17 STL. Check console.");
    });

    // 3. Add some random rocks AROUND (optional if STL serves as ground)
    // We'll wait for STL to load.
}


function createEarthTerrain(config) {
    console.log("Generating Earth Terrain...");

    // 1. Atmosphere
    scene.fog = new THREE.FogExp2(0xaaccff, 0.008);
    scene.background = new THREE.Color(0xaaccff);

    // 2. Terrain Geometry
    const size = 2000;
    const segments = 256; // Higher resolution for detail
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const count = geometry.attributes.position.count;
    const positions = geometry.attributes.position;

    // Create color attribute
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const colors = geometry.attributes.color;

    const colorDeepWater = new THREE.Color(0x004080);
    const colorWater = new THREE.Color(0x0077be);
    const colorSand = new THREE.Color(0xd4c483); // Beige
    const colorGrass = new THREE.Color(0x567d46); // Muted Green
    const colorForest = new THREE.Color(0x2d4c1e); // Dark Green
    const colorRock = new THREE.Color(0x666666); // Grey
    const colorSnow = new THREE.Color(0xffffff);

    for (let i = 0; i < count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);

        // Height Map Calculation (Multi-Frequency Noise)
        // 1. Large Hills
        let y = Math.sin(x / 150) * 15 + Math.cos(z / 120) * 15;
        // 2. Medium Details
        y += Math.sin(x / 40) * 4 + Math.cos(z / 40) * 4;
        // 3. Roughness
        y += Math.sin(x / 5) * 0.5 + Math.cos(z / 5) * 0.5;

        // Flatten valleys (Water)
        if (y < -5) y = -5 + (y + 5) * 0.2;

        positions.setY(i, y);

        // Vertex Coloring based on Height
        let mixedColor;

        if (y < -4) {
            // Deep Water
            mixedColor = colorDeepWater;
        } else if (y < -1) {
            // Shallow Water
            mixedColor = colorDeepWater.clone().lerp(colorWater, (y + 4) / 3);
        } else if (y < 2) {
            // Sand / Beach
            mixedColor = colorSand;
        } else if (y < 20) {
            // Grass -> Forest
            const t = (y - 2) / 18;
            mixedColor = colorGrass.clone().lerp(colorForest, t);
        } else if (y < 35) {
            // Forest -> Rock
            const t = (y - 20) / 15;
            mixedColor = colorForest.clone().lerp(colorRock, t);
        } else {
            // Rock -> Snow
            const t = Math.min(1, (y - 35) / 10);
            mixedColor = colorRock.clone().lerp(colorSnow, t);
        }

        colors.setXYZ(i, mixedColor.r, mixedColor.g, mixedColor.b);
    }

    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.8,
        metalness: 0.1,
        flatShading: true
    });

    const terrain = new THREE.Mesh(geometry, material);
    terrain.receiveShadow = true;
    scene.add(terrain);
    currentTerrainMesh = terrain;

    // 3. Water Plane
    const waterGeo = new THREE.PlaneGeometry(size, size);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
        color: 0x0077be,
        roughness: 0.1,
        metalness: 0.8,
        transparent: true,
        opacity: 0.8
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = -4.5; // New Water level (matches terrain generation)
    scene.add(water);

    // 4. Vegetation (Trees & Grass)
    createTrees(positions, count);
    createGrass(positions, count);
}

function createGrass(positions, count) {
    console.log("Creating Instanced Grass...");

    // Geometry: Simple blade
    const bladeGeo = new THREE.PlaneGeometry(0.1, 0.8);
    bladeGeo.translate(0, 0.4, 0); // Pivot at bottom

    // Material
    const bladeMat = new THREE.MeshStandardMaterial({
        color: 0x45a145,
        side: THREE.DoubleSide,
        roughness: 0.8
    });

    const instanceCount = 80000;
    const mesh = new THREE.InstancedMesh(bladeGeo, bladeMat, instanceCount);

    const dummy = new THREE.Object3D();
    let instanceIndex = 0;

    for (let i = 0; i < instanceCount; i++) {
        // Random Position
        const x = (Math.random() - 0.5) * 1800;
        const z = (Math.random() - 0.5) * 1800;

        // Calculate Height (Same logic as terrain)
        let y = Math.sin(x / 150) * 15 + Math.cos(z / 120) * 15;
        y += Math.sin(x / 40) * 4 + Math.cos(z / 40) * 4;
        y += Math.sin(x / 5) * 0.5 + Math.cos(z / 5) * 0.5;

        if (y < -5) y = -5 + (y + 5) * 0.2; // Water clamp

        // Filter: Grass only on "Land" but not "Rock/Snow"
        // Range: 2 to 25
        if (y > 2.5 && y < 25) {
            dummy.position.set(x, y, z);

            const scale = 0.5 + Math.random() * 1.0;
            dummy.scale.set(scale, scale, scale);

            dummy.rotation.y = Math.random() * Math.PI;

            dummy.updateMatrix();
            mesh.setMatrixAt(instanceIndex++, dummy.matrix);
        }
    }

    mesh.count = instanceIndex; // Update actual count
    mesh.receiveShadow = true;
    // mesh.castShadow = true; // Expensive for grass
    scene.add(mesh);
}

function createTrees(positions, count) {
    // Type A: Pine (Cone)
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 1.5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
    const leavesGeoA = new THREE.ConeGeometry(1.5, 3, 8);
    const leavesMatA = new THREE.MeshStandardMaterial({ color: 0x228b22 });

    // Type B: Oak (Sphere)
    const leavesGeoB = new THREE.DodecahedronGeometry(1.5, 1);
    const leavesMatB = new THREE.MeshStandardMaterial({ color: 0x3a5f0b });

    const treeCount = 1500;
    for (let i = 0; i < treeCount; i++) {
        const x = (Math.random() - 0.5) * 1800; // Wider range
        const z = (Math.random() - 0.5) * 1800;

        // Skip spawn area
        if (Math.abs(x) < 20 && Math.abs(z) < 20) continue;

        // Calculate Height at x,z
        let y = Math.sin(x / 150) * 15 + Math.cos(z / 120) * 15;
        y += Math.sin(x / 40) * 4 + Math.cos(z / 40) * 4;
        y += Math.sin(x / 5) * 0.5 + Math.cos(z / 5) * 0.5;

        // Only place on land
        if (y > 2.0 && y < 30) {
            const treeGroup = new THREE.Group();

            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 0.75;
            treeGroup.add(trunk);

            if (Math.random() > 0.5) {
                // Pine
                const leaves = new THREE.Mesh(leavesGeoA, leavesMatA);
                leaves.position.y = 2.25;
                treeGroup.add(leaves);
            } else {
                // Oak
                const leaves = new THREE.Mesh(leavesGeoB, leavesMatB);
                leaves.position.y = 2.5;
                leaves.scale.set(0.8, 0.8, 0.8);
                treeGroup.add(leaves);
            }

            // "Immerge" inside
            treeGroup.position.set(x, y - 0.2, z);

            const scale = 0.6 + Math.random() * 0.8;
            treeGroup.scale.set(scale, scale, scale);

            scene.add(treeGroup);
            obstacles.push({ x: x, z: z, r: 0.5 * scale });
        }
    }
}

// 5. Rocks
const rockGeoA = new THREE.DodecahedronGeometry(1, 0); // Sharp
const rockGeoB = new THREE.IcosahedronGeometry(1, 0);  // Rounder
const rockMat = new THREE.MeshStandardMaterial({ color: 0x777777, flatShading: true });
const rockMatDark = new THREE.MeshStandardMaterial({ color: 0x555555, flatShading: true });

const rockCount = 1500;
for (let i = 0; i < rockCount; i++) {
    // Clumped distribution: bias towards certain random centers
    // Actually, let's just use random + gaps
    if (Math.random() > 0.6) continue; // Gap

    const x = (Math.random() - 0.5) * 1800; // Expanded range
    const z = (Math.random() - 0.5) * 1800;

    if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;

    // Calculate Height exactly
    let y = Math.sin(x / 50) * 5 + Math.cos(z / 40) * 5;
    y += Math.sin(x / 10) * 1 + Math.cos(z / 10) * 1;

    if (y > -1.2) { // Allow some rocks near shore
        let rock;
        if (Math.random() > 0.5) {
            rock = new THREE.Mesh(rockGeoA, rockMat);
        } else {
            rock = new THREE.Mesh(rockGeoB, rockMatDark);
        }

        // Sink rocks slightly (immerging)
        rock.position.set(x, y + 0.3, z);

        const s = 0.5 + Math.random() * 2.5; // Big size variance
        rock.scale.set(s, s, s);
        rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

        scene.add(rock);
        obstacles.push({ x: x, z: z, r: s });
    }
}


function loadHotspots(planetName) {
    hotspots = [];
    const config = window.PlanetConfig[planetName];
    if (!config) return;

    // --- 7. Hotspots (Educational) ---
    const hotspotGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const hotspotMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true });

    // Use config facts or fallback
    const educationFacts = config.facts || [
        { title: `PLANET: ${config.name}`, content: config.description }
    ];

    educationFacts.forEach((fact, index) => {
        const mesh = new THREE.Mesh(hotspotGeo, hotspotMat);

        // Random Position (avoid 0,0)
        // Range: -80 to 80
        let x = (Math.random() - 0.5) * 160;
        let z = (Math.random() - 0.5) * 160;

        // Avoid spawn area
        if (Math.abs(x) < 10) x += 20;
        if (Math.abs(z) < 10) z += 20;

        // Height adjustment (simple)
        let y = 1.5; // Float above ground

        mesh.position.set(x, y, z);
        scene.add(mesh);

        const data = {
            title: fact.title,
            content: fact.content + "<br><br>" + `(Info Point ${index + 1}/${educationFacts.length})`
        };

        hotspots.push({ mesh: mesh, data: data });
    });
}

function onKeyDown(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveForward = true; break;
        case 'ArrowLeft':
        case 'KeyA': moveLeft = true; break;
        case 'ArrowDown':
        case 'KeyS': moveBackward = true; break;
        case 'ArrowRight':
        case 'KeyD': moveRight = true; break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveForward = false; break;
        case 'ArrowLeft':
        case 'KeyA': moveLeft = false; break;
        case 'ArrowDown':
        case 'KeyS': moveBackward = false; break;
        case 'ArrowRight':
        case 'KeyD': moveRight = false; break;
    }
}

function createMobileMoveControls() {
    if (document.getElementById('mobile-move-controls')) return;
    if (!window.matchMedia || !window.matchMedia('(max-width: 700px)').matches) return;

    const controls = document.createElement('div');
    controls.id = 'mobile-move-controls';
    controls.style.cssText = `
        position: fixed;
        left: 16px;
        bottom: 78px;
        z-index: 2500;
        display: grid;
        grid-template-columns: 54px 54px 54px;
        grid-template-rows: 54px 54px 54px;
        gap: 8px;
        pointer-events: auto;
        touch-action: none;
        user-select: none;
    `;

    const makeButton = (label, title, activeState) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.innerText = label;
        btn.title = title;
        btn.style.cssText = `
            width: 54px;
            height: 54px;
            border: 1px solid rgba(0, 240, 255, 0.9);
            background: rgba(0, 20, 35, 0.72);
            color: white;
            font-size: 20px;
            font-family: 'Montserrat', sans-serif;
            box-shadow: 0 0 14px rgba(0, 240, 255, 0.28);
            backdrop-filter: blur(8px);
            cursor: pointer;
        `;

        const setActive = (isActive) => {
            if (activeState === 'forward') moveForward = isActive;
            if (activeState === 'backward') moveBackward = isActive;
            if (activeState === 'left') moveLeft = isActive;
            if (activeState === 'right') moveRight = isActive;
            btn.style.background = isActive ? 'rgba(0, 240, 255, 0.35)' : 'rgba(0, 20, 35, 0.72)';
        };

        btn.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            btn.setPointerCapture(event.pointerId);
            setActive(true);
        });

        const release = (event) => {
            event.preventDefault();
            setActive(false);
        };

        btn.addEventListener('pointerup', release);
        btn.addEventListener('pointercancel', release);
        btn.addEventListener('pointerleave', release);

        return btn;
    };

    const forward = makeButton('↑', 'Move forward', 'forward');
    const left = makeButton('←', 'Turn left', 'left');
    const back = makeButton('↓', 'Move backward', 'backward');
    const right = makeButton('→', 'Turn right', 'right');

    forward.style.gridColumn = '2';
    forward.style.gridRow = '1';
    left.style.gridColumn = '1';
    left.style.gridRow = '2';
    right.style.gridColumn = '3';
    right.style.gridRow = '2';
    back.style.gridColumn = '2';
    back.style.gridRow = '3';

    controls.appendChild(forward);
    controls.appendChild(left);
    controls.appendChild(right);
    controls.appendChild(back);
    document.body.appendChild(controls);

    const hint = document.getElementById('controls-hint');
    if (hint) hint.innerText = 'Use touch controls to move and turn';
}

function removeMobileMoveControls() {
    const controls = document.getElementById('mobile-move-controls');
    if (controls) controls.remove();

    moveForward = false;
    moveBackward = false;
    moveLeft = false;
    moveRight = false;
}

function animate() {
    animationId = requestAnimationFrame(animate);

    const delta = 0.05;

    // Animate Hotspots
    hotspots.forEach(hotspot => {
        hotspot.mesh.rotation.x += 0.01;
        hotspot.mesh.rotation.y += 0.02;
    });

    if (player) {
        const speed = 2.0; // Slow movement
        const rotateSpeed = 0.8; // Low sensitivity

        // Rotation
        if (moveLeft) player.rotation.y += rotateSpeed * delta;
        if (moveRight) player.rotation.y -= rotateSpeed * delta;

        // Calculate potential new position
        let newX = player.position.x;
        let newZ = player.position.z;

        if (moveForward) {
            newX -= Math.sin(player.rotation.y) * speed * delta;
            newZ -= Math.cos(player.rotation.y) * speed * delta;
        }
        if (moveBackward) {
            newX += Math.sin(player.rotation.y) * speed * delta;
            newZ += Math.cos(player.rotation.y) * speed * delta;
        }

        // Collision Detection (with Sliding)
        const correctedPos = resolveCollision(newX, newZ);
        player.position.x = correctedPos.x;
        player.position.z = correctedPos.z;

        // Terrain Following (Raycasting)
        if (currentTerrainMesh) {
            const raycaster = new THREE.Raycaster();
            const rayOrigin = new THREE.Vector3(player.position.x, 50, player.position.z);
            raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));

            const intersects = raycaster.intersectObject(currentTerrainMesh);
            if (intersects.length > 0) {
                // Base height on terrain
                let groundHeight = intersects[0].point.y;

                // Walking bob
                if (moveForward || moveBackward) {
                    const time = performance.now() * 0.01;
                    groundHeight += Math.abs(Math.sin(time)) * 0.2;
                }

                player.position.y = groundHeight;
            } else {
                // Fallback if off mesh
                player.position.y = 0;
            }
        } else {
            // Flat ground fallback
            if (moveForward || moveBackward) {
                const time = performance.now() * 0.01;
                player.position.y = Math.abs(Math.sin(time)) * 0.2;
            } else {
                player.position.y = 0;
            }
        }

        // Camera Follow
        const relativeOffset = cameraOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.y);
        const cameraTargetPos = player.position.clone().add(relativeOffset);
        camera.position.lerp(cameraTargetPos, 0.1);

        // Look a bit above the player
        camera.lookAt(player.position.clone().add(new THREE.Vector3(0, 1.5, 0)));

        // --- Hotspot Proximity Check ---
        let activeHotspot = null;
        let minDist = Infinity;

        hotspots.forEach(hotspot => {
            const dist = player.position.distanceTo(hotspot.mesh.position);
            if (dist < INTERACTION_DISTANCE) {
                if (dist < minDist) {
                    minDist = dist;
                    activeHotspot = hotspot;
                }
            }
        });

        const infoPanel = document.getElementById('info-panel');
        if (activeHotspot) {
            infoPanel.style.display = 'block';
            document.getElementById('info-title').innerText = activeHotspot.data.title;
            document.getElementById('info-content').innerHTML = activeHotspot.data.content;
            document.getElementById('info-dist').innerText = Math.round(minDist) + "m";
        } else {
            infoPanel.style.display = 'none';
        }

        // --- Turret Tracking Logic ---
        activeTurrets.forEach(turret => {
            const dist = turret.group.position.distanceTo(player.position);
            const sensor = turret.sensor;
            const head = turret.head;

            if (dist < 15) {
                // TRACKING
                sensor.material.color.setHex(0xff0000); // Red when active/tracking

                // Determine target look position
                const targetPos = player.position.clone();
                targetPos.y += 1.5; // Look at head level

                head.lookAt(targetPos);
            } else {
                // IDLE SCAN
                sensor.material.color.setHex(0x00ff00); // Green
                head.rotation.y = Math.sin(performance.now() * 0.0005) * 0.5;
                head.rotation.x = 0; // Reset tilt
            }
        });
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.stopPlanetSurface = function () {
    if (animationId) cancelAnimationFrame(animationId);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('resize', onWindowResize);
    removeMobileMoveControls();
    removeDefenseButton(); // Ensure UI is cleaned up
};

window.initPlanetSurface = initPlanetSurface;

// --- MARS DEFENSE SYSTEM LOGIC ---

function createDefenseButton() {
    if (document.getElementById('defense-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'defense-btn';
    btn.innerText = "BUILD DEFENSE";
    btn.style.cssText = `
        position: fixed; top: 100px; right: 30px; z-index: 1000;
        padding: 20px 40px; background: linear-gradient(135deg, rgba(255, 69, 0, 0.9), rgba(200, 50, 0, 0.9)); 
        border: 4px solid #ffaa00; color: white;
        font-family: 'Montserrat', sans-serif; font-weight: 900; font-size: 20px;
        cursor: pointer; text-transform: uppercase; letter-spacing: 2px;
        backdrop-filter: blur(10px); transition: all 0.3s;
        box-shadow: 0 0 30px rgba(255, 69, 0, 0.8), inset 0 0 20px rgba(255, 200, 0, 0.3);
        border-radius: 10px;
        text-shadow: 0 2px 4px rgba(0,0,0,0.5);
    `;

    btn.onmouseenter = () => btn.style.transform = "scale(1.05)";
    btn.onmouseleave = () => btn.style.transform = "scale(1)";
    btn.onclick = initDefenseGame;

    document.body.appendChild(btn);
}

function removeDefenseButton() {
    const btn = document.getElementById('defense-btn');
    if (btn) btn.remove();
}

// Mini-Game State
let defenseParts = [];
let defenseProgress = 0;

function initDefenseGame() {
    if (document.getElementById('defense-modal')) return;

    // Game Modal
    const modal = document.createElement('div');
    modal.id = 'defense-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.9); z-index: 5000;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        font-family: 'Montserrat', sans-serif; color: #ff4500;
    `;

    // Ensure we release mouse capture for interaction
    if (document.pointerLockElement) {
        document.exitPointerLock();
    }

    modal.innerHTML = `
        <h1 style="font-size: 60px; margin-bottom: 20px; text-shadow: 0 0 30px #ff4500; font-weight: 900;">ASSEMBLE PLANETARY DEFENSE</h1>
        <p style="color: white; font-size: 24px; margin-bottom: 60px; text-shadow: 0 2px 5px black;">SEQUENCE: BASE - GUN - CORE</p>
        
        <div style="display: flex; gap: 60px; transform: scale(1.2);">
            <div id="part-base" class="def-part" style="cursor: pointer; text-align: center; transition: transform 0.2s;">
                <div style="width: 150px; height: 150px; border: 4px solid white; background: rgba(50,50,50,0.9); display: flex; align-items: center; justify-content: center; border-radius: 15px; transition: all 0.2s; box-shadow: 0 0 20px rgba(255,255,255,0.2);">
                    <span style="font-size: 60px;">🏗️</span>
                </div>
                <div style="margin-top: 15px; color: white; font-size: 20px; font-weight: bold;">BASE STRUCTURE</div>
            </div>
            
             <div id="part-gun" class="def-part" style="cursor: pointer; text-align: center; opacity: 0.5; transition: transform 0.2s;">
                <div style="width: 150px; height: 150px; border: 4px solid white; background: rgba(50,50,50,0.9); display: flex; align-items: center; justify-content: center; border-radius: 15px; transition: all 0.2s; box-shadow: 0 0 20px rgba(255,255,255,0.2);">
                    <span style="font-size: 60px;">🔫</span>
                </div>
                <div style="margin-top: 15px; color: white; font-size: 20px; font-weight: bold;">TURRET CANNONS</div>
            </div>
            
             <div id="part-core" class="def-part" style="cursor: pointer; text-align: center; opacity: 0.5; transition: transform 0.2s;">
                <div style="width: 150px; height: 150px; border: 4px solid white; background: rgba(50,50,50,0.9); display: flex; align-items: center; justify-content: center; border-radius: 15px; transition: all 0.2s; box-shadow: 0 0 20px rgba(255,255,255,0.2);">
                    <span style="font-size: 60px;">🔋</span>
                </div>
                <div style="margin-top: 15px; color: white; font-size: 20px; font-weight: bold;">POWER CORE</div>
            </div>
        </div>
        
        <button id="cancel-defense-btn" style="margin-top: 80px; padding: 15px 50px; background: rgba(0,0,0,0.5); border: 2px solid #aaa; color: #aaa; cursor: pointer; font-size: 18px; text-transform: uppercase; border-radius: 5px; transition: all 0.3s;">CANCEL MISSION</button>
    `;

    document.body.appendChild(modal);
    window.defenseProgress = 0; // Explicitly attach to window

    // Add robust Event Listeners instead of string-based onclicks
    const base = document.getElementById('part-base');
    const gun = document.getElementById('part-gun');
    const core = document.getElementById('part-core');

    if (base) {
        base.addEventListener('click', () => window.assemblePart('base'));
        base.onmouseenter = () => { if (window.defenseProgress === 0) base.style.transform = "rotate(5deg) scale(1.1)"; };
        base.onmouseleave = () => base.style.transform = "scale(1)";
    }
    if (gun) {
        gun.addEventListener('click', () => window.assemblePart('gun'));
        gun.onmouseenter = () => { if (window.defenseProgress === 1) gun.style.transform = "rotate(5deg) scale(1.1)"; };
        gun.onmouseleave = () => gun.style.transform = "scale(1)";
    }
    if (core) {
        core.addEventListener('click', () => window.assemblePart('core'));
        core.onmouseenter = () => { if (window.defenseProgress === 2) core.style.transform = "rotate(5deg) scale(1.1)"; };
        core.onmouseleave = () => core.style.transform = "scale(1)";
    }

    // Handle Cancel Button
    const cancelBtn = document.getElementById('cancel-defense-btn');
    if (cancelBtn) cancelBtn.onclick = window.closeDefenseGame;
}

window.assemblePart = function (part) {
    const base = document.getElementById('part-base');
    const gun = document.getElementById('part-gun');
    const core = document.getElementById('part-core');

    if (part === 'base') {
        if (window.defenseProgress > 0) return; // Already done

        base.children[0].style.borderColor = '#00ff00';
        base.children[0].style.background = '#004400';
        // base.style.pointerEvents = 'none'; // Keep clickable just in case, but no-op

        gun.style.opacity = '1';
        gun.style.boxShadow = '0 0 30px #00ff00'; // Highlight next step
        window.defenseProgress = 1;

    } else if (part === 'gun') {
        if (window.defenseProgress < 1) {
            alert("⚠️ CONSTRUCTION ERROR: Build the BASE STRUCTURE first!");
            return;
        }
        if (window.defenseProgress > 1) return;

        gun.children[0].style.borderColor = '#00ff00';
        gun.children[0].style.background = '#004400';
        gun.style.boxShadow = 'none';

        core.style.opacity = '1';
        core.style.boxShadow = '0 0 30px #00ff00'; // Highlight next step
        window.defenseProgress = 2;

    } else if (part === 'core') {
        if (window.defenseProgress < 2) {
            const missing = window.defenseProgress === 0 ? "BASE STRUCTURE" : "TURRET CANNONS";
            alert(`⚠️ CONSTRUCTION ERROR: Install the ${missing} first!`);
            return;
        }

        core.children[0].style.borderColor = '#00ff00';
        core.children[0].style.background = '#004400';
        core.style.boxShadow = 'none';
        window.defenseProgress = 3; // Fully complete

        setTimeout(() => {
            alert("SYSTEM ONLINE: Turret Constructed.");
            window.closeDefenseGame();
            spawnTurret();
        }, 500);
    }
};

window.closeDefenseGame = function () {
    const m = document.getElementById('defense-modal');
    if (m) m.remove();
};

function spawnTurret() {
    if (!player || !scene) return;

    console.log("Spawning Turret...");

    // Position: In front of the player
    const spawnPos = player.position.clone();
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(player.quaternion);
    spawnPos.add(direction.multiplyScalar(5)); // 5 meters in front

    // --- Ground Placement Logic ---
    // Raycast down from high up to find the exact terrain height
    let groundY = 0;
    if (currentTerrainMesh) {
        const raycaster = new THREE.Raycaster();
        const rayOrigin = new THREE.Vector3(spawnPos.x, 50, spawnPos.z);
        raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
        const intersects = raycaster.intersectObject(currentTerrainMesh);
        if (intersects.length > 0) {
            groundY = intersects[0].point.y;
        } else {
            // If off-mesh, try to approximate or keep at 0 if no better option
            groundY = 0;
        }
    }
    spawnPos.y = groundY;

    const turretGroup = new THREE.Group();
    turretGroup.position.copy(spawnPos);
    turretGroup.scale.set(2, 2, 2); // Make it BIGGER

    // --- 1. Tripod Base (Standing Firm) ---
    const baseGroup = new THREE.Group();
    turretGroup.add(baseGroup);

    const legMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7, metalness: 0.8 });
    const legGeo = new THREE.BoxGeometry(0.2, 1.5, 0.2);

    // Leg 1
    const leg1 = new THREE.Mesh(legGeo, legMat);
    leg1.position.set(0, 0.6, 0.8);
    leg1.rotation.x = -0.5;
    baseGroup.add(leg1);

    // Leg 2
    const leg2 = new THREE.Mesh(legGeo, legMat);
    leg2.position.set(0.7, 0.6, -0.4);
    leg2.rotation.x = 0.5;
    leg2.rotation.z = -0.5; // Spread out
    leg2.rotation.y = 2.0; // Rotate around
    baseGroup.add(leg2);

    // Leg 3
    const leg3 = new THREE.Mesh(legGeo, legMat);
    leg3.position.set(-0.7, 0.6, -0.4);
    leg3.rotation.x = 0.5;
    leg3.rotation.z = 0.5;
    leg3.rotation.y = -2.0;
    baseGroup.add(leg3);

    // Central Pillar
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 1.0), legMat);
    pillar.position.y = 0.5;
    baseGroup.add(pillar);

    // Platform
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 0.2, 8), legMat);
    platform.position.y = 1.1;
    baseGroup.add(platform);


    // --- 2. Swivel Head (Tracking Part) ---
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.2;
    turretGroup.add(headGroup);

    // Main Housing
    const housingMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.4, metalness: 0.4 }); // Industrial Orange
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 1.0), housingMat);
    housing.castShadow = true;
    headGroup.add(housing);

    // Vents / Details
    const ventMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.5), ventMat);
    housing.add(vent); // Overlap slightly

    // Guns
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.2 });
    const barrelGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.8);
    barrelGeo.rotateX(Math.PI / 2);

    // Left Gun
    const gunL = new THREE.Mesh(barrelGeo, barrelMat);
    gunL.position.set(-0.5, 0, 0.5);
    headGroup.add(gunL);

    // Right Gun
    const gunR = new THREE.Mesh(barrelGeo, barrelMat);
    gunR.position.set(0.5, 0, 0.5);
    headGroup.add(gunR);

    // Sensor / Eye / Core
    const sensorGeo = new THREE.SphereGeometry(0.2);
    const sensorMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green Idle
    const sensor = new THREE.Mesh(sensorGeo, sensorMat);
    sensor.position.set(0, 0.1, 0.5);
    headGroup.add(sensor);


    scene.add(turretGroup);

    // Add to obstacles for collisions
    obstacles.push({ x: spawnPos.x, z: spawnPos.z, r: 1.5 });

    // Store for tracking in main loop
    activeTurrets.push({
        group: turretGroup,
        head: headGroup,
        sensor: sensor
    });
}

window.createDefenseButton = createDefenseButton;
window.removeDefenseButton = removeDefenseButton;
window.removeMobileMoveControls = removeMobileMoveControls;

