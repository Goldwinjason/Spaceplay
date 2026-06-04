// Planet Configuration Module
// This file acts as the single source of truth for all planet data.

const PlanetConfig = {
    Mercury: {
        name: "Mercury",
        radius: 2439.7,
        distance: 57.9,
        gravity: "0.38G",
        temp: "167°C",
        o2: "NONE",
        description: "The closest planet to the sun. It circles the sun faster than all the other planets.",
        facts: [
            { title: "Smallest Planet", content: "Mercury is the smallest planet in our solar system, only slightly larger than Earth's Moon." },
            { title: "Two Faces", content: "Mercury is tidally locked in a unique 3:2 spin-orbit resonance." },
            { title: "Extreme Temps", content: "Temperatures range from -173°C at night to 427°C during the day." },
            { title: "No Atmosphere", content: "It has a very thin exosphere made of atoms blasted off the surface by solar wind." },
            { title: "Fast Year", content: "A year on Mercury is just 88 Earth days long." },
            { title: "Ice Water", content: "Radar observations suggest that ice may exist in the shadowed craters at the poles." },
            { title: "Iron Core", content: "It has a massive metallic core which is about 85% of its radius." }
        ],
        textures: {
            satellite: "https://www.solarsystemscope.com/images/textures/full/2k_mercury.jpg",
            surface: "textures/mercury_surface.jpg"
        },
        colors: { base: 0xaaaaaa, atmosphere: 0xaaaaaa, ground: 0xaaaaaa, fog: 0xaaaaaa }
    },
    Venus: {
        name: "Venus",
        radius: 6051.8,
        distance: 108.2,
        gravity: "0.9G",
        temp: "464°C",
        o2: "TOXIC",
        description: "Named for the Roman goddess of love and beauty. Hottest planet in the solar system.",
        facts: [
            { title: "Sister Planet", content: "Venus is similar in structure and size to Earth, often called Earth's twin." },
            { title: "Hottest World", content: "Its thick atmosphere traps heat, making it the hottest planet, hotter than Mercury." },
            { title: "Backward Spin", content: "Venus spins in the opposite direction (retrograde rotation) to most other planets." },
            { title: "Long Day", content: "A day on Venus is longer than its year!" },
            { title: "Crushing Pressure", content: "The atmospheric pressure is 92 times greater than Earth's." },
            { title: "Volcanic Surface", content: "Venus has more volcanoes than any other planet in the solar system." },
            { title: "No Moons", content: "Venus and Mercury are the only planets in our solar system without moons." }
        ],
        textures: {
            satellite: "https://www.solarsystemscope.com/images/textures/full/2k_venus_surface.jpg",
            surface: "textures/venus_surface.jpg"
        },
        colors: { base: 0xeebb33, atmosphere: 0xeebb33, ground: 0xeebb33, fog: 0xeebb33 }
    },
    Earth: {
        name: "Earth",
        radius: 6371,
        distance: 149.6,
        gravity: "1.0G",
        temp: "15°C",
        o2: "OPTIMAL",
        description: "Our home. It is the only planet known to have an atmosphere containing free oxygen.",
        facts: [
            { title: "Water World", content: "About 71% of Earth's surface is covered with water." },
            { title: "Life", content: "Earth is the only known planet to support life." },
            { title: "Atmosphere", content: "The atmosphere protects us from meteoroids and radiation." },
            { title: "Magnetic Field", content: "Earth's magnetic field shields us from the solar wind." },
            { title: "Moon", content: "Earth has one large natural satellite, the Moon." },
            { title: "Tectonic Plates", content: "Earth's outer shell is divided into several plates that glide over the mantle." },
            { title: "Perfect Spot", content: "Earth is in the Goldilocks zone, where liquid water can exist." }
        ],
        textures: {
            satellite: "https://www.solarsystemscope.com/images/textures/full/2k_earth_daymap.jpg",
            surface: "textures/earth_surface.jpg"
        },
        colors: { base: 0x2e64c9, atmosphere: 0x87CEEB, ground: 0x2e64c9, fog: 0x87CEEB }
    },
    Mars: {
        name: "Mars",
        radius: 3389.5,
        distance: 227.9,
        gravity: "0.38G",
        temp: "-63°C",
        o2: "NONE",
        description: "The Red Planet. Home to the tallest mountain in the solar system, Olympus Mons.",
        facts: [
            { title: "Red Color", content: "The red color comes from iron oxide (rust) in the soil." },
            { title: "Olympus Mons", content: "Home to the tallest volcano in the solar system, Olympus Mons." },
            { title: "Two Moons", content: "Mars has two small irregular moons: Phobos and Deimos." },
            { title: "Thin Air", content: "The atmosphere is thin and mostly carbon dioxide." },
            { title: "Dust Storms", content: "Mars has the largest dust storms in the solar system." },
            { title: "Water Ice", content: "There are ice caps at both poles containing frozen water and CO2." },
            { title: "Exploration", content: "Mars is the most explored planet by rovers and orbiters." }
        ],
        textures: {
            satellite: "https://www.solarsystemscope.com/images/textures/full/2k_mars.jpg",
            surface: "textures/mars_surface.jpg"
        },
        colors: { base: 0xc1440e, atmosphere: 0xc68b77, ground: 0xc1440e, fog: 0xc68b77 }
    },
    Jupiter: {
        name: "Jupiter",
        radius: 69911,
        distance: 778.6,
        gravity: "2.4G",
        temp: "-145°C",
        o2: "TOXIC",
        description: "The largest planet in the solar system. A gas giant with a Great Red Spot.",
        facts: [
            { title: "King Planet", content: "Jupiter is so big that all other planets could fit inside it." },
            { title: "Gas Giant", content: "It is mostly made of hydrogen and helium." },
            { title: "Great Red Spot", content: "A giant storm that has raged for hundreds of years." },
            { title: "Fast Spin", content: "Jupiter has the shortest day of all planets (only 10 hours)." },
            { title: "Many Moons", content: "It has 95 known moons including Ganymede, the largest moon." },
            { title: "Faint Rings", content: "Jupiter has a faint ring system, discovered in 1979." },
            { title: "Magnetic Field", content: "It has the strongest magnetic field in the solar system." }
        ],
        textures: {
            satellite: "https://www.solarsystemscope.com/images/textures/full/2k_jupiter.jpg",
            surface: "textures/jupiter_surface.jpg"
        },
        colors: { base: 0xd8ca9d, atmosphere: 0xd8ca9d, ground: 0xaaaaaa, fog: 0xd8ca9d }
    },
    Saturn: {
        name: "Saturn",
        radius: 58232,
        distance: 1433.5,
        gravity: "1.0G",
        temp: "-178°C",
        o2: "TOXIC",
        description: "Known for its spectacular ring system. The second largest planet.",
        facts: [
            { title: "Ring System", content: "Saturn has the most extensive and complex ring system." },
            { title: "Low Density", content: "It is the only planet less dense than water; it would float in a giant bathtub!" },
            { title: "Titan", content: "Its moon Titan is the second-largest moon and has a thick atmosphere." },
            { title: "Windy World", content: "Winds on Saturn can reach 1,800 km/h." },
            { title: "Flat Poles", content: "Its rapid rotation causes it to flatten at the poles." },
            { title: "Hexagon Storm", content: "There is a persistent hexagonal cloud pattern at its north pole." },
            { title: "Moons Galore", content: "Saturn has 146 known moons, the most in the solar system." }
        ],
        textures: {
            satellite: "https://www.solarsystemscope.com/images/textures/full/2k_saturn.jpg",
            surface: "textures/saturn_surface.jpg"
        },
        colors: { base: 0xdec584, atmosphere: 0xebdcb2, ground: 0xdec584, fog: 0xebdcb2 }
    },
    Uranus: {
        name: "Uranus",
        radius: 25362,
        distance: 2872.5,
        gravity: "0.9G",
        temp: "-224°C",
        o2: "TOXIC",
        description: "The first planet discovered by telescope. Rotates on its side.",
        facts: [
            { title: "Ice Giant", content: "Uranus is an Ice Giant, composed mostly of water, methane, and ammonia fluids." },
            { title: "Sideways World", content: "It rotates on its side, rolling like a ball." },
            { title: "Coldest Planet", content: "It holds the record for the coldest temperature measured: -224°C." },
            { title: "Blue Green", content: "Methane in the atmosphere gives it a blue-green color." },
            { title: "Rings", content: "Uranus has two sets of rings." },
            { title: "Moons", content: "It has 27 moons, named after characters from Shakespeare and Pope." },
            { title: "Retrograde", content: "Like Venus, Uranus rotates east to west." }
        ],
        textures: {
            satellite: "https://www.solarsystemscope.com/images/textures/full/2k_uranus.jpg",
            surface: "textures/uranus_surface.jpg"
        },
        colors: { base: 0xaecbc9, atmosphere: 0xaecbc9, ground: 0xbbe1e6, fog: 0xaecbc9 }
    },
    Neptune: {
        name: "Neptune",
        radius: 24622,
        distance: 4495.1,
        gravity: "1.1G",
        temp: "-214°C",
        o2: "TOXIC",
        description: "Dark, cold, and whipped by supersonic winds. The most distant planet.",
        facts: [
            { title: "Farthest Planet", content: "Neptune is the most distant major planet from the Sun." },
            { title: "Windy", content: "It has the strongest winds in the solar system, up to 2,100 km/h." },
            { title: "Long Year", content: "One year on Neptune is 165 Earth years." },
            { title: "Triton", content: "Its largest moon, Triton, orbits in the opposite direction to the planet's rotation." },
            { title: "Dark Spots", content: "Neptune has large dark storms similar to Jupiter's Red Spot." },
            { title: "Ring Arcs", content: "It has five rings and four ring arcs." },
            { title: "Discovery", content: "It was the first planet predicted by mathematics before being observed." }
        ],
        textures: {
            satellite: "https://www.solarsystemscope.com/images/textures/full/2k_neptune.jpg",
            surface: "textures/neptune_surface.jpg"
        },
        colors: { base: 0x4b70dd, atmosphere: 0x4b70dd, ground: 0x6081ff, fog: 0x4b70dd }
    },
    Pluto: {
        name: "Pluto",
        radius: 1188.3,
        distance: 5906.4,
        gravity: "0.06G",
        temp: "-229°C",
        o2: "NONE",
        description: "A dwarf planet in the Kuiper Belt. Has a heart-shaped glacier.",
        facts: [
            { title: "Dwarf Planet", content: "Pluto was reclassified from a planet to a dwarf planet in 2006." },
            { title: "The Heart", content: "Pluto has a large heart-shaped glacier made of nitrogen ice." },
            { title: "Charon", content: "Its largest moon, Charon, is so big that they orbit each other." },
            { title: "Kuiper Belt", content: "It resides in the Kuiper Belt, a ring of bodies beyond Neptune." },
            { title: "Blue Skies", content: "Pluto has a thin nitrogen atmosphere that scatters blue light." },
            { title: "Slow Orbit", content: "Pluto takes 248 Earth years to orbit the Sun." },
            { title: "Mountains", content: "It has mountains made of water ice that are as tall as the Rockies." }
        ],
        textures: {
            satellite: "https://www.solarsystemscope.com/images/textures/full/2k_makemake_fictional.jpg",
            surface: "textures/pluto_surface.jpg"
        },
        colors: { base: 0xe3d6c1, atmosphere: 0xe3d6c1, ground: 0xe3d6c1, fog: 0xe3d6c1 }
    },
    Moon: {
        name: "Moon",
        radius: 1737.4,
        distance: 0.384, // million km
        gravity: "0.16G",
        temp: "-130°C",
        o2: "NONE",
        description: "Earth's only natural satellite. The fifth largest satellite in the Solar System.",
        facts: [
            { title: "No Atmosphere", content: "The Moon has virtually no atmosphere, so no weather and skies are always black." },
            { title: "Low Gravity", content: "Gravity is only about 16.6% of Earth's. You could jump 6 times higher!" },
            { title: "Tidal Locking", content: "We always see the same face of the Moon because it rotates at the same speed it orbits." },
            { title: "Craters", content: "Its surface is covered in craters from billions of years of meteorite impacts." },
            { title: "Apollo Missions", content: "Humans visited the Moon between 1969 and 1972 on the Apollo missions." },
            { title: "Moonquakes", content: "The Moon experiences 'moonquakes' caused by Earth's gravitational pull." },
            { title: "Water Ice", content: "Ice has been found in permanently shadowed craters at the poles." }
        ],
        textures: {
            satellite: "https://www.solarsystemscope.com/images/textures/full/2k_moon.jpg",
            surface: "textures/moon_surface.jpg"
        },
        colors: {
            base: 0x888888,
            atmosphere: 0x000000,
            ground: 0x888888,
            fog: 0x000000
        }
    }
};

window.PlanetConfig = PlanetConfig;
