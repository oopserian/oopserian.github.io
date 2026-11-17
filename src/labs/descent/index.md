---
title: Descent
summary: One unbroken shot from 16,000 km up into the sea off the Canary Islands at sunset, through the atmosphere and the clouds, past Mount Teide, and a thousand metres down. Drag or scroll to fall.
tags: [WebGL2, Raymarching]
date: 2026-11-17
order: 17
dark: true
prompt: |-
  Add a continuous fall from orbit into the deep sea to my project: one unbroken shot that starts 16,000 km above the Canary Islands at sunset, drops through the atmosphere and a field of cumulus, meets the sea 26 km east of Tenerife with Mount Teide on the horizon, and sinks to a thousand metres. Everything should read as physically real. Draw it with raw WebGL2 and one fullscreen fragment shader for the scene, with no three.js and no libraries: one file of shaders, one engine file, one small file for the camera path, and a thin component in my existing framework that only holds the instruments and the controls.

  0. Start from what exists
  - Find where the piece will live, which framework mounts it, my button and icon components, my mono font, and how my site switches between light and dark. The stage is always dark whatever the theme; reuse my tokens for the text and buttons drawn over it.
  - If I already have WebGL helpers, use them for context checks; you will still need half-float render targets, 3D textures and single-channel data textures, so add those locally if my helpers don't have them.

  1. Data
  - Earth: NASA Blue Marble at 4096 × 2048 (equirectangular), a city-lights and land-mask texture at 2048 × 1024, and a satellite cloud map at 4096 × 2048. Ship WebP; load 2048-wide copies when the stage is under 700 px wide.
  - Terrain: Canary Islands elevation from AWS Terrain Tiles (SRTM, GMTED, ETOPO1), reprojected to a 2048 × 768 equirectangular grid covering 18.4°W–13.2°W and 27.55°N–29.5°N, stored as grey v with height = v² × 3.8 km, lossless. Also store the maximum height of each 16 × 16 block, dilated by one block, as a 128 × 48 texture sampled with nearest filtering. Upload data textures with UNPACK_COLORSPACE_CONVERSION_WEBGL = NONE.
  - Decode all five images before the first frame so the planet never flashes black.

  2. The camera path
  - The viewpoint is 28.3°N, 16.1°W. The sun sits at azimuth 250° and 1.7° above the horizon. Headings are measured from the sun's azimuth; Teide is at +17°.
  - Progress p from 0 to 1 maps to altitude, pitch, roll, exposure and heading through 23 keys, interpolated with a monotone cubic (Fritsch–Carlson) so nothing overshoots; interpolate altitude as sign(a) × log(1 + |a|). Key points: 16,000 km looking straight down at p = 0; 1,500 km at 0.15; 48 km at 0.32 turning 15° toward Teide; 4.9 km just above the cloud tops at 0.47; 760 m under the cloud base at 0.527; 4 m at 0.69; the waterline at 0.705–0.722; −14 m looking up at 0.775; −130 m at 0.87; −1,000 m looking down at 1.
  - Never park the camera exactly on the cloud base. Below 3 m, ride the camera on the wave height at its position (computed in JS with the same wave set), blended in smoothly, so the waterline really sweeps across the lens.
  - Field of view: tan(half-width) = max(tan 26° × √aspect, 0.4), so a tall stage still fits the globe; on a wide, short stage keep tan(half-height) at least 0.38 (the path's pitches were set on 16:10), but never let the half-width pass 45°.

  3. Atmosphere
  - Bruneton/Hillaire style: Earth radius 6,371 km, atmosphere 100 km, Rayleigh scattering (5.802, 13.558, 33.1) × 10⁻³ km⁻¹, Mie scattering 4.6 × 10⁻³ and extinction 5.1 × 10⁻³, ozone absorption (0.650, 1.881, 0.085) × 10⁻³. Precompute a 256 × 64 transmittance table, a 32 × 32 multiple-scattering table (8 × 8 directions, ground albedo 0.12) and a 64 × 16 sky irradiance table once at start.
  - Per pixel, integrate along the view ray with up to 64 samples, spaced quadratically when the camera is inside the atmosphere. Below the cloud tops, multiply the sun by a three-sample cloud shadow. Draw the sun as a disc of angular radius 0.00465 rad, with the edge of Earth's shadow softened by that disc.

  4. Earth and the islands
  - From high up, shade the globe from the textures: ocean, land, city lights on the night side, the cloud map lit by the atmosphere tables, a specular sun glint on the water, stars at 0.05.
  - Inside the islands' box, the coastline comes from the elevation, not the texture. Intersect rays with the height field in a 0–3.8 km shell: step 3.6 km at a time where the max map says nothing is tall, walk finer near terrain (step max(0.55 × height gap, 4 m + 0.0022 × distance), at most 110 steps), then bisect 6 times. Normals from height differences. Colour by height, slope and aspect: ochre lowlands, pine between 0.55 and 2.15 km, pumice and black lava in the caldera above 1.9 km, the bare cone above 2.8 km. March 20 steps toward the sun for terrain shadows. Draw the low islands into the reflection map too, so the sea mirrors the mountain.

  5. Clouds
  - A shell from 1.0 to 3.6 km. Far away, the satellite map sets coverage. Around the drop point, lay a designed cumulus field: a clear lane toward the sun that runs out to Tenerife (seen from 20 km away when high up, opening right in front of you once you're under the clouds), so Teide stays visible from the sea, and a thick column straight below so the camera really passes through cloud.
  - Shape comes from a tileable Perlin-Worley 3D noise generated on the GPU at 128³ (one draw per slice), detail from a 32³ noise. Pick the mip from the pixel footprint so the lattice never shows from orbit. Let the detail push the iso-surface (base += (0.5 − detail) × 0.22 near the threshold) instead of remapping density, or the clouds look like marshmallow. Threshold mix(0.74, 0.26, coverage), density 34 km⁻¹.
  - March up to 160 steps of clamp(0.014 × distance, 45 m, segment ÷ 6). Light each sample with 6 steps toward the sun, starting at 70 m and growing ×1.9. Use Wrenninge's multiple-scattering approximation with 4 octaves (scattering × 0.5, extinction × 0.25, phase anisotropy × 0.5 each octave) and a two-lobe Henyey-Greenstein phase, mix(HG(−0.15), HG(0.75), 0.72). Ambient from the irradiance table, 35% at the base rising to 100% at the top, plus a faint bounce from the sea.

  6. The sea
  - Sharpened sines, h = A(2u^1.5 − 1) with u = ½ + ½ sin θ and deep-water dispersion ω = √(gk). Seven swells with wavelengths 118, 83, 61, 47, 37, 29 and 23 m in directions spread over ±63°, steepness 0.020–0.029. Then 25 short waves whose wave vectors are integer pairs on a 24 m tile (k = 2π|(m, n)| ÷ 24, steepness 0.062 × (|(m, n)| ÷ 4)^−0.1); the caustics depend on that period.
  - To hide the tile, modulate each short wave's amplitude (0.3–1.7) and phase with two noise layers at 83 m and 57 m, but not within 2–12 m of the camera, so the JS wave height still matches.
  - Waves shorter than 2–6 pixels fade out and their slope variance goes into the GGX roughness (base 0.0035). Large wind slicks at 1,730 m and 610 m scale the slopes between 0.35 and 1.65. Add two capillary ripple layers at 45 cm and 17 cm from the detail noise, folded into roughness when they're under a pixel.
  - Near the camera, intersect the real surface in a ±1.6 m slab: 40 marching steps, then 7 bisections. Reflect a 192 × 96 environment map with mips, add the deep-water upwelling blue, and let low sun shine through the thin wave crests.

  7. Under the surface
  - Clear ocean water: absorption (0.26, 0.046, 0.017) m⁻¹, particle scattering 0.028 m⁻¹ with HG g = 0.86, molecular scattering (0.0011, 0.0024, 0.0058). Diffuse light falls off with Kd = 1.12 × absorption + 0.004; the refracted sun beam falls off along its own path. Integrate 44 samples out to 160 m, with light shafts from the caustic map.
  - Caustics: refract a 220 × 220 grid of the 24 m wave tile to 4 m depth, add the area ratio of each triangle into a 512² half-float tile (additive blending, 9 instanced copies for wrap), build mips, and fade it with depth.
  - Looking up: the Snell window and total internal reflection. Ease the critical angle (cos 0.6612) over a width set by the unresolved slope variance, so the edge breaks up instead of drawing hard rings. Cool the sky seen through the window a little, or sunset light through water turns neon green.
  - The eye adapts: multiply by exp(min(0.78 × 0.021 × depth, 7.6)), so it still gets darker with depth and is nearly black at 1,000 m. Warm the white balance near the surface and shift it slowly as the reds go.
  - Particles drawn after accumulation: 2,600 flakes of marine snow streaking with vertical speed, 520 bubbles above −40 m, and below −420 m a short-lived bioluminescent glow wherever the pointer or a finger passes.

  8. Post
  - Render the scene to a half-float target about 0.72 × the stage's CSS size (scaled down further when the stage's √(width × height) is over 1,100 px), then: temporal accumulation once the camera has been still for 3 frames (weight min(0.85, n ÷ (n + 2))), a 6-level bloom at 0.045, the key's exposure, AgX tone mapping, film grain 0.022, dither and a 0.28 vignette, output at up to 2× device pixels.

  9. Instruments and input
  - Over the picture, in my mono font: the altitude bottom left (16,000 km, 4.9 km, 760 m, −14 m with a real minus sign) and the name of the layer under it (Exosphere, Thermosphere, Mesosphere, Stratosphere, Troposphere, Cloud deck, Marine layer, Sea surface, Sunlight zone, Twilight zone, Midnight zone). On the right, a log-scale altitude gauge: the top 62% runs from 16,000 km to 1 m, the bottom 38% from the surface to −1,000 m, with a small diamond for the camera.
  - The gauge is a vertical slider (role="slider", value 0–100 for altitude, valuetext like "4.9 km, Troposphere"): drag or click it to jump, invert its position to progress by bisection. Focused, arrows move 0.012, Page Up/Down 0.06, Home and End go to orbit and the deep, Space plays and pauses.
  - Dragging the picture up falls (a full stage height is a ninth of the way); on a large stage the wheel falls too (14,000 px of wheel for the whole way) and lets the page scroll again once you're at either end. On touch, swiping on a large stage falls; on a small card it stays page scroll and the gauge does the falling. All of these move a target, and progress eases toward it at 1 − e^(−2.6 dt). Divide every input by √(dwell), where dwell slows the interesting parts (the globe, 4.9 km, the cloud base, the waterline, the shallows).
  - A Play button falls on its own in about a minute (dt ÷ 78 ÷ dwell × 1.55 per frame) and replays from orbit at the bottom. At the bottom, fade in "A thousand metres down, sunlight gives out." with a Back to orbit button. Moving the mouse over the picture turns the camera toward it, up to 2.5° sideways and 1.6° up or down.
  - One-line hint at the bottom, worded for mouse and for touch, gone once you start falling.

  10. Cost and fallback
  - Compile all programs at once with KHR_parallel_shader_compile and wait for them off the main thread.
  - Draw every frame while anything moves. When still: below 20 km the sea, clouds and snow keep moving, so draw 30 frames a second; higher up, stop after 24 frames once accumulation has settled. Stop entirely when the stage is off screen or the tab is hidden. Drop the render scale by 14% (down to 0.42) when frames average over 25 ms, measured only while drawing every frame, and raise it 8% at a time when under 17 ms.
  - Under prefers-reduced-motion: freeze time so the waves and clouds stand still, jump to the target without easing, and disable Play and the glow.
  - Without WebGL2, or when the renderer is a software one (SwiftShader, llvmpipe), or if a shader fails or the context is lost, show a pre-rendered still of the 4.9 km view with the instruments set to it.

  11. Done when
  - One continuous fall from a dusk globe to black water with no cuts: the terminator and city lights from orbit, sunset-lit cumulus with Teide on the horizon, a golden sea that you break through, light shafts and caustics, then blue, then dark.
  - No tiling or lattice is visible from any height, the camera never sits inside the cloud base, and the waterline crossing has no seam.
  - Mouse, touch and keyboard all work on a card and on a full page, the page still scrolls where it should, the console is clean, and nothing draws when nothing changes up high.
  - You tell me every file you added or changed.
---
