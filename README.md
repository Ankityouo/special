# Cosmic Address

A seamless zoom from your spot on Earth to the edge of the observable universe, and a little beyond, rendered live in the browser with WebGL 2.

Letters find you by street, city and country. This is the rest of your address:

> You · Earth · Solar System · Orion Arm · Milky Way · Local Group · Virgo Supercluster · Laniakea Supercluster · Observable Universe · …

Scroll through 23 orders of magnitude, from 10⁷ m to 10³⁰ m, without a single cut.

## Run it

Open `index.html` in a recent Chrome, Edge, Firefox or Safari. No server or build step is needed, and nothing is fetched except web fonts.

To share a single file, bundle everything, including the Earth imagery, into `dist/cosmic-address.html`:

```sh
python3 tools/build.py
```

## Controls

| Action | Mouse / keyboard | Touch |
| --- | --- | --- |
| Zoom | Scroll, `↑` `↓`, `+` `−` | Pinch |
| Look around | Drag, `←` `→` | Drag |
| Guided journey | **Journey** button, `Space` | Journey button |
| Jump to a scale | Click a line of your address or a dot on the ruler, keys `1`–`9`, `0` | Tap an address line |
| Return to Earth | **Return home**, `Home` | Return home |
| Labels / text / sound / full screen | `L` / `T` / `M` / `F` | Buttons |
| Hide the whole interface | `H` | — |

**Text** hides the story, your address and the scale readout so the scene has the whole screen. Labels and text settings are remembered in your browser.

Deep links open at a scale, for example `index.html#milkyway`. The ids are `earth`, `moon`, `inner`, `planets`, `helio`, `oort`, `neighbors`, `orion`, `milkyway`, `localgroup`, `virgo`, `laniakea`, `web`, `observable` and `beyond`.

## What is real

- **Now.** Earth's rotation, day and night, the Moon's position and phase, and every planet are computed for the current moment: JPL Keplerian elements (Standish) for the planets, a low-precision lunar theory for the Moon, and sidereal time for Earth's spin.
- **You.** The "you are here" pin is placed from your browser's time zone. It is an estimate, and the location never leaves your browser.
- **Earth.** NASA Blue Marble imagery, NASA city lights and cloud cover, lit by a per-pixel single-scattering atmosphere (Rayleigh and Mie).
- **Sky and neighbors.** About 130 bright stars and 40 nearby stars sit at their real positions and distances, so constellations line up and the 3D neighborhood is accurate. The same goes for 17 nebulae and clusters and the Voyager and New Horizons probes.
- **Milky Way.** A 400,000-particle model with a bar tilted 27° to the Sun–center line and four log-spiral arms (Perseus, Sagittarius–Carina, Scutum–Centaurus, Norma/Outer) at 12° pitch. The Sun sits in the Orion Spur 26,660 light-years from the center, and globular clusters and the Magellanic Clouds are included.
- **Local Group.** Andromeda and Triangulum are oriented by their measured inclination and position angle, surrounded by about 25 catalogued dwarf galaxies.
- **Laniakea.** Real clusters sit at their true directions and distances: Virgo, Fornax, Centaurus, Hydra, Norma/Great Attractor, Coma, Perseus–Pisces and Shapley. Animated flow lines show galaxies draining toward the Great Attractor.
- **Cosmic web and beyond.** These are procedural. A Voronoi foam places galaxies on walls, filaments and nodes. The observable universe is shown as a look-back sphere ending at the cosmic microwave background. The last scale, **Beyond**, is labeled as speculation because it is.

Positions are good to a fraction of a degree. This is a map to feel scale with, not an ephemeris.

## How it works

Every scale lives in its own layer with its own unit (Earth radii, AU, light-years, kly, Mly, Gly), so single-precision GPU math stays exact across 23 orders of magnitude. The camera is defined once as `z = log10(distance to focus in meters)`. Its focus glides from Earth to the Sun, the Galactic Center, the Local Group and Laniakea, and its reference frame blends from Earth's axis to the ecliptic to the galactic plane. Each layer derives its own camera from that, and layers cross-fade by `z`.

Rendering is plain WebGL 2 with no libraries:

- HDR targets with a 13-tap downsample and tent-upsample bloom, ACES tone mapping and dithered grain.
- Ray-traced sphere impostors for Earth, the Moon, the Sun and the cosmic shells.
- Flux-conserving point sprites for about 1.5 million particles.
- Instanced anti-aliased lines for orbits and flow lines.
- A generative Web Audio score: a drone that darkens as you travel outward, wind that follows zoom speed, and sparse bells.

```
index.html          page, styles, interface
js/core.js          units, math, noise, astronomy, coordinate frames
js/data.js          star, galaxy and cluster catalogs; narrative
js/gfx.js           WebGL engine, shaders, post-processing
js/scene.js         layers, focus path, frame blending, per-layer cameras
js/layers/*.js      sky, earth, solar, stars, galaxy, localgroup, laniakea, web, universe, beyond
js/labels.js        3D-anchored labels with collision avoidance
js/audio.js         generative score
js/app.js           loop, input, guided journey, interface
assets/textures.js  Earth imagery as data URIs (generated by tools/make_textures.py)
tools/build.py      single-file bundler
```

## Credits

Earth imagery: NASA Visible Earth (Blue Marble, Earth at Night, clouds), public domain, repackaged in the MIT-licensed [three-globe](https://github.com/vasturiano/three-globe) package. Fonts: Jost, Newsreader and IBM Plex Mono (SIL Open Font License). Planetary elements: E. M. Standish, JPL, *Keplerian Elements for Approximate Positions of the Major Planets*.
