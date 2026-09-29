# Cosmic Address

A seamless zoom through 65 orders of magnitude, rendered live in the browser with WebGL 2: out from your spot on Earth to the edge of the observable universe, and in, through your own fingertip, to the Planck length.

Letters find you by street, city and country. This is the rest of your address:

> … · Proton · Nucleus · Carbon atom · DNA · Cell · You · Earth · Solar System · Orion Arm · Milky Way · Local Group · Virgo Supercluster · Laniakea Supercluster · Observable Universe · …

Scroll from 10⁻³⁵ m to 10³⁰ m without a single cut.

## Run it

Open `index.html` in a recent Chrome, Edge, Firefox or Safari, on a computer or a phone. No server or build step is needed, and nothing is fetched except web fonts.

To share a single file, bundle everything, including the Earth imagery, into `dist/cosmic-address.html`:

```sh
python3 tools/build.py
```

Quality adapts to your device on its own. To pin it, add `?q=low`, `?q=mid`, `?q=high` or `?q=ultra` to the address (ultra renders at up to 4K).

## The 25 scales

| Inward | | Outward | |
| --- | --- | --- | --- |
| Edge of Space | 10⁵ m | Earth | 10⁷ m |
| You | 10⁰ m | Earth and Moon | 10⁹ m |
| Fingertip | 10⁻³ m | Inner Solar System, The Planets | 10¹¹–10¹³ m |
| Cell | 10⁻⁴ m | Heliosphere, Oort Cloud | 10¹⁴–10¹⁷ m |
| DNA | 10⁻⁸ m | Stellar Neighborhood, Orion Arm | 10¹⁸–10¹⁹ m |
| Carbon Atom | 10⁻¹⁰ m | Milky Way, Local Group | 10²¹–10²³ m |
| Carbon Nucleus, Proton | 10⁻¹⁴–10⁻¹⁵ m | Virgo Supercluster, Laniakea, Cosmic Web | 10²⁴–10²⁶ m |
| Uncharted | 10⁻¹⁹ m | Observable Universe | 10²⁷ m |
| Planck Length | 10⁻³⁵ m | Beyond | 10²⁹ m |

The guided journey goes out to Beyond, then back and in to the Planck length.

## Controls

| Action | Mouse / keyboard | Touch |
| --- | --- | --- |
| Zoom | Scroll, `↑` `↓`, `+` `−` | Pinch |
| Look around | Drag, `←` `→` | Drag |
| Guided journey | **Journey** button, `Space` | Journey button |
| Previous or next scale | `,` `.` (or Page Down, Page Up) | — |
| Jump outward | Keys `1`–`9`, `0`; a dot on the ruler; a line of your address | Tap an address line |
| Jump inward | `Shift`+`1`–`9` (You to Planck length), `Shift`+`0` (Edge of Space) | Tap an address line |
| Return to Earth | **Return home**, `Home` | Return home |
| Labels / text / sound / full screen | `L` / `T` / `M` / `F` | Buttons |
| Hide the whole interface | `H` | — |

**Text** hides the story, your address and the scale readout so the scene has the whole screen. **Labels** also hides guide lines such as constellation figures and distance rings. Both settings are remembered in your browser.

Deep links open at a scale, for example `index.html#cell`. The ids are `planck`, `uncharted`, `proton`, `nucleus`, `atom`, `dna`, `cell`, `skin`, `you`, `edge`, `earth`, `moon`, `inner`, `planets`, `helio`, `oort`, `neighbors`, `orion`, `milkyway`, `localgroup`, `virgo`, `laniakea`, `web`, `observable` and `beyond`.

## What is real

- **Now.** Earth's rotation, day and night, the Moon's position and phase, and every planet are computed for the current moment: JPL Keplerian elements (Standish) for the planets, a low-precision lunar theory for the Moon, and sidereal time for Earth's spin.
- **You.** Your spot is estimated from your browser's time zone and never leaves your browser. Below the atmosphere the sky is your sky at this moment: the Sun, Moon, planets, stars and Milky Way sit where they are over your location, seen through a scattering atmosphere, with stars hidden by daylight. The figure of light is a stand-in for you.
- **Earth.** NASA Blue Marble imagery, NASA city lights and cloud cover, lit by a per-pixel single-scattering atmosphere (Rayleigh, Mie and ozone). Up close, the terrain, coastlines, waves, cloud edges and street grids are procedural detail layered on the satellite maps, which are about 10 km per pixel. The aurora ovals sit around the geomagnetic poles (IGRF, 2025); their brightness is illustrative. Satellites follow the real shells and inclinations of today's constellations and move at true orbital speeds, but they are not live positions.
- **Sky and neighbors.** About 170 bright stars and 40 nearby stars sit at their real positions and distances, and 20 constellation figures join them. Seen from Earth the figures match the sky; fly away from the Sun and they come apart, because their stars lie at very different distances. Nebulae, clusters and the Voyager and New Horizons probes are placed the same way.
- **Milky Way.** A 400,000-particle model with a bar tilted 27° to the Sun–center line and four log-spiral arms (Perseus, Sagittarius–Carina, Scutum–Centaurus, Norma/Outer) at 12° pitch. The Sun sits in the Orion Spur 26,660 light-years from the center, and globular clusters and the Magellanic Clouds are included.
- **Local Group.** Andromeda and Triangulum are oriented by their measured inclination and position angle, surrounded by about 25 catalogued dwarf galaxies.
- **Laniakea.** Real clusters sit at their true directions and distances: Virgo, Fornax, Centaurus, Hydra, Norma/Great Attractor, Coma, Perseus–Pisces and Shapley, along with famous galaxies such as M87, the Whirlpool and the Sombrero. Animated flow lines show galaxies draining toward the Great Attractor.
- **Cosmic web and beyond.** These are procedural. A Voronoi foam places galaxies on walls, filaments and nodes. The observable universe is shown as a look-back sphere ending at the cosmic microwave background. The last scale, **Beyond**, is labelled speculative because it is.
- **Fingertip and cell.** Sizes are to scale: friction ridges 0.46 mm apart with pores along their crests, and skin cells about 28 µm across. The cell is drawn the way a confocal fluorescence microscope shows one, in stain colours, with an optical section that keeps only the focal plane sharp. It is an illustration, not a photograph of a particular cell.
- **DNA.** Nucleosomes carry 147 base pairs in 1.65 turns around a histone spool, joined by linker DNA into a fiber. Near the focus every heavy atom is drawn: bases from the standard base-pair reference frames (Olson et al., 2001) and an approximate sugar-phosphate backbone. The histone cores are stand-ins coloured by chain (H3 blue, H4 green, H2A yellow, H2B red).
- **Carbon atom.** The cloud is sampled from hydrogen-like orbitals with Slater's effective charges: two 1s electrons in the core and four valence electrons in sp3 hybrids aimed at the atom's actual bonded neighbours in the DNA model.
- **Nucleus and proton.** Carbon-12 is drawn as three alpha clusters, a standard model of its structure. The proton is a qualitative picture of quantum chromodynamics: two up quarks and a down quark whose colour charges keep swapping, gluon flux tubes meeting in a Y, and virtual quark pairs.
- **Uncharted and Planck length.** No experiment has seen structure below about 10⁻¹⁹ m, so these scales are drawn as a scale-invariant field of vacuum fluctuations and, at the bottom, a speculative spacetime foam. Both are labelled as such.

Positions are good to a fraction of a degree. This is a map to feel scale with, not an ephemeris.

## How it works

Every scale lives in its own layer with its own unit (Planck lengths, femtometers, picometers, nanometers, micrometers, millimeters, meters, Earth radii, AU, light-years, kly, Mly, Gly), so single-precision GPU math stays exact. The camera is defined once as `z = log10(distance to focus in meters)`.

- **Outward**, the focus glides from Earth to the Sun, the Galactic Center, the Local Group and Laniakea, and the reference frame blends from Earth's axis to the ecliptic to the galactic plane.
- **Inward**, the frame becomes your local horizon and the focus glides to your spot on the ground. Below that, a single offset from Earth's center cannot hold the precision (a double resolves about a nanometer at Earth's radius), so the inner scales are nested levels. Each level has its own unit, and its origin is the previous level's anchor: your chest, then a fingertip, a skin cell, a strand of chromatin, a carbon atom, a proton and a quark.

Each layer derives its own camera from that, and layers cross-fade by `z`. Where two scales meet, they share geometry: the skin and cell layers hash the same grid, so the zoom lands inside exactly the cell it was heading for, and the carbon atom is picked by ray-testing clear lines of sight through the DNA model.

Rendering is plain WebGL 2 with no libraries:

- HDR targets with a 13-tap downsample and tent-upsample bloom, ACES tone mapping, dithered grain and warp streaks during fast travel.
- Earth is ray-traced relative to the camera, so the same shader works from the Moon's distance down to the grass under your feet.
- Ray-marched signed distance fields for the figure and the fingertip, and ray-traced sphere impostors for the Moon, the Sun, atoms, nucleons and the cosmic shells.
- Flux-conserving point sprites for about 2.5 million particles, and instanced anti-aliased lines for orbits, flow lines and constellations.
- A generative Web Audio score: a drone that darkens as you travel outward and brightens as you travel inward, wind that follows zoom speed, and sparse bells.

## Performance and compatibility

- Works in any browser with WebGL 2: current Chrome, Edge, Firefox and Safari (15 and later), on desktop, Android and iOS. Without WebGL 2 the page explains what is missing.
- A quality governor watches the frame rate and trades render resolution and shader detail (atmosphere samples, ray-march steps and noise octaves) until frames run smoothly, then climbs back when there is headroom.
- Shaders compile in the background where the browser supports it (`KHR_parallel_shader_compile`), and each scale is built progressively, closest first, so the first view appears quickly.
- Particle counts scale with the device, dense scenes use level of detail and culling, and GPUs with small texture limits get downscaled Earth maps.
- If a scale fails on some GPU, it is skipped and the rest of the journey keeps working.

```
index.html            page, styles, interface
js/core.js            units, math, noise, hashing, astronomy, coordinate frames
js/data.js            star, constellation, galaxy and cluster catalogs; narrative
js/gfx.js             WebGL engine, shaders, post-processing, device tiers
js/scene.js           layers, nested levels, focus path, frame blending, per-layer cameras
js/layers/*.js        sky, earth, you, skin, cell, dna, atom, nucleus, proton, foam,
                      solar, stars, galaxy, localgroup, laniakea, web, universe, beyond
js/labels.js          3D-anchored labels with collision avoidance
js/audio.js           generative score
js/app.js             loop, input, quality governor, guided journey, interface
assets/textures.js    Earth imagery as data URIs (generated by tools/make_textures.py)
tools/build.py        single-file bundler
```

## Credits

Earth imagery: NASA Visible Earth (Blue Marble, Earth at Night, clouds), public domain, repackaged in the MIT-licensed [three-globe](https://github.com/vasturiano/three-globe) package. Fonts: Jost, Newsreader and IBM Plex Mono (SIL Open Font License). Planetary elements: E. M. Standish, JPL, *Keplerian Elements for Approximate Positions of the Major Planets*. Base geometry: W. K. Olson et al., *A standard reference frame for the description of nucleic acid base-pair geometry*, J. Mol. Biol. 313 (2001). Atmospheric transmittance: C. Schüler, *An Approximation to the Chapman Grazing-Incidence Function for Atmospheric Scattering*, GPU Pro 3 (2012). Geomagnetic pole: IGRF-14.
