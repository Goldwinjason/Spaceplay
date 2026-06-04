// Main UI Logic and State Management

// State Enum
// State Enum
const AppState = {
    SOLAR: 'SOLAR',
    SATELLITE: 'SATELLITE',
    SURFACE: 'SURFACE'
};

// Ensure globals are on window for HTML onclicks
window.currentState = AppState.SOLAR;
window.currentActivePlanet = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('Solar System Loaded');

    // Initial Button Text Setup
    const activeRadio = document.querySelector('input[name="planet"]:checked');
    if (activeRadio) {
        const pName = activeRadio.id;
        const displayName = pName.charAt(0).toUpperCase() + pName.slice(1);
        const targetSpan = document.getElementById('target-planet-name');
        if (targetSpan) targetSpan.innerText = displayName;

        // Show Moon button if Earth
        const moonBtn = document.getElementById('global-moon-btn');
        if (moonBtn) {
            moonBtn.style.display = (pName.toLowerCase() === 'earth') ? 'inline-block' : 'none';
        }
    }

    // Attach event listeners to all "Explore Surface" buttons
    // Note: In the HTML, these buttons are currently hardcoded to "Explore Surface"
    // We will intercept them to show a choice or go to Satellite view first as per requirements
    // For now, let's keep them as "Surface" but add a new way to access Satellite.
    const exploreButtons = document.querySelectorAll('.explore-btn');
    exploreButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const planetName = e.target.getAttribute('data-planet'); // Use getAttribute to be safe

            // Per requirements: VIEW PLANETS FROM SATELLITE/ORBIT VIEW first.
            // So clicking "Explore Surface" on the card should probably take us to Satellite View
            // where we can then choose to land.
            enterSatelliteView(planetName);
        });
    });

    // Global "Land on X" button
    const globalBtn = document.getElementById('global-explore-btn');
    if (globalBtn) {
        // We replace the default click with our new logic
        globalBtn.replaceWith(globalBtn.cloneNode(true));
        document.getElementById('global-explore-btn').addEventListener('click', () => {
            // Logic to track active planet from radio buttons is in index.html script
            // We need to read that state or just rely on the UI
            const activeRadio = document.querySelector('input[name="planet"]:checked');
            if (activeRadio) {
                const planetId = activeRadio.id;
                const planetName = planetId.charAt(0).toUpperCase() + planetId.slice(1);
                enterSatelliteView(planetName);
            }
        });

        // Re-attach radio listeners because we replaced the button (and its internal span was referenced by old listeners)
        // gracefully handle text updates
        const radios = document.querySelectorAll('input[name="planet"]');
        radios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const pName = e.target.id;
                const displayName = pName.charAt(0).toUpperCase() + pName.slice(1);
                const targetSpan = document.getElementById('target-planet-name');
                if (targetSpan) targetSpan.innerText = displayName;

                // Show Moon button if Earth
                const moonBtn = document.getElementById('global-moon-btn');
                if (moonBtn) {
                    moonBtn.style.display = (pName.toLowerCase() === 'earth') ? 'inline-block' : 'none';
                }


            });
        });
    }
});

// --- State Transitions ---

function enterSatelliteView(planetName) {
    if (!window.PlanetConfig[planetName]) {
        console.error("Unknown planet:", planetName);
        return;
    }

    console.log(`Entering Satellite View: ${planetName}`);
    window.currentState = AppState.SATELLITE;
    window.currentActivePlanet = planetName;

    hideSolarInterface();

    // Initialize/Show Satellite View
    if (window.initSatelliteView) {
        document.getElementById('satellite-container').style.display = 'block';
        window.initSatelliteView(planetName);
    } else {
        console.warn("Satellite View module not loaded");
        // Fallback for now (debugging)
        startSurfaceExploration(planetName);
    }
}

function startSurfaceExploration(planetName) {
    console.log(`Landing on Surface: ${planetName}`);
    window.currentState = AppState.SURFACE;
    // Fallback if planetName is undefined (called from click with undefined var)
    if (!planetName && window.currentActivePlanet) {
        planetName = window.currentActivePlanet;
    }
    window.currentActivePlanet = planetName;

    hideSolarInterface();
    document.getElementById('satellite-container').style.display = 'none'; // Ensure satellite is hidden

    // Show Surface Container
    const surfaceContainer = document.getElementById('surface-container');
    surfaceContainer.style.display = 'block';

    // Initialize Three.js Scene for this planet
    if (window.initPlanetSurface) {
        window.initPlanetSurface(planetName);
    }
}

function returnToOrbit() {
    console.log("Returning to Orbit (Satellite View)...");

    // Stop Surface View
    const surfaceContainer = document.getElementById('surface-container');
    surfaceContainer.style.display = 'none';
    if (window.stopPlanetSurface) {
        window.stopPlanetSurface();
    }

    // Return to Satellite View
    if (window.currentActivePlanet) {
        enterSatelliteView(window.currentActivePlanet);
    } else {
        returnToSolarSystem();
    }
}

function returnToSolarSystem() {
    console.log("Returning to Solar System...");
    window.currentState = AppState.SOLAR;
    window.currentActivePlanet = null;

    // Stop and Hide Satellite View
    document.getElementById('satellite-container').style.display = 'none';
    if (window.stopSatelliteView) {
        window.stopSatelliteView();
    }

    // Stop and Hide Surface View (just in case)
    document.getElementById('surface-container').style.display = 'none';
    if (window.stopPlanetSurface) {
        window.stopPlanetSurface();
    }

    restoreSolarInterface();
}


// --- UI Helpers ---

function hideSolarInterface() {
    const solar = document.querySelector('.solar');
    if (solar) solar.style.display = 'none';

    document.querySelectorAll('.panel').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.menu').forEach(el => el.style.display = 'none');

    const logo = document.querySelector('.logo');
    if (logo) logo.style.display = 'none';

    if (document.getElementById('global-controls')) document.getElementById('global-controls').style.display = 'none';
}

function restoreSolarInterface() {
    const solar = document.querySelector('.solar');
    if (solar) solar.style.display = '';

    document.querySelectorAll('.panel').forEach(el => el.style.display = '');
    document.querySelectorAll('.menu').forEach(el => el.style.display = '');

    const logo = document.querySelector('.logo');
    if (logo) logo.style.display = '';

    if (document.getElementById('global-controls')) document.getElementById('global-controls').style.display = 'block';
}

// Export functions for global usage
window.startSurfaceExploration = startSurfaceExploration;
window.returnToOrbit = returnToOrbit;
window.returnToSolarSystem = returnToSolarSystem;
window.enterSatelliteView = enterSatelliteView;
