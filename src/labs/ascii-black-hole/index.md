---
title: ASCII Black Hole
summary: A black hole drawn entirely in ASCII characters, from light bent live in a shader that you never see. Sweep across the disk to feed it, click to drop a star in.
tags: [WebGL, Shaders]
date: 2026-11-09
order: 13
prompt: |-
  Add an ASCII black hole to my project: a black hole with a glowing accretion disk, its light bent live in a WebGL2 shader and shown only as ASCII characters, where sweeping the pointer across the disk feeds it streaks of hot gas and a click drops in a star that gets torn apart. Use raw WebGL2 with no 3D library: one engine file, plus a thin component in my existing framework. The canvas is transparent and fills its container; don't change my page's styles.

  0. Start from what exists
  - Find where the effect will live, which framework mounts it, and how my site switches between light and dark. Reuse that theme signal; don't add a new one.
  - If I already have WebGL helpers (context, shader compile, render targets), use them.

  1. The black hole (offscreen)
  - Measure everything in horizon radii. The camera sits 24 away, 12° above the disk's plane, looking at the hole, with the frame rolled 5°. The vertical half-view has a tangent of 0.22, widened so the horizontal half-view is at least 0.3 on narrow screens.
  - For every pixel, trace the ray as a photon around a Schwarzschild black hole: acceleration −1.5 h² x / r⁵, where h = |x × v| is fixed by the starting ray, stepped with velocity Verlet at 0.07 r + 0.01 per step, up to 170 steps. Inside r = 1 it is captured and black. Beyond 1.3× the camera distance and moving outward, it has escaped and shows the stars.
  - The disk is a thin sheet in the plane, from r = 3 (the innermost stable orbit) to 11. Each time the ray crosses the plane inside that range, interpolate the crossing within the step and add the disk's light there. Let each crossing absorb up to 90% of what lies behind, so the far side of the disk, bent up over the hole and down under it, shows as two arcs, and the rays that skim the hole build a thin bright ring.
  - Brightest at the inner edge: smoothstep in over the first 0.5, then (3/r)^1.8, fading out from 55% of the outer radius.
  - Streak the disk with gas that orbits faster inside than out. Cut it into rings 0.3 wide. Each ring turns a whole number of times per 12-second loop, round(6 × (r/3)^−1.5) and at least once. Crossfade neighbouring rings, so rings that turn at the same rate share one pattern. Use value noise that repeats exactly around the circle, 14 and 42 cells per turn, long along the orbit and fine across it.
  - The side turning toward the camera is brighter: with β = min(√(0.5 / (r − 1)), 0.5) along the orbit, multiply by D^2.5, where D = √(1 − β²) / (1 − β cos θ). Dim the light from deep in by √(1 − 1/r). Compress the sum with 1 − exp(−3L).
  - Stars: cut the escaped direction into a lattice of 110 cells per radian. One cell in ten holds a star that twinkles a whole number of times per loop. Near the hole, the bending doubles them up.
  - Hash the noise lattices with integer maths (uvec multiplies and xor), not sin().
  - Store per pixel: the brightness, what share of it comes from gas or stars the visitor added (or, where there is no disk, how bright the star is), and the direction the characters should run, as a double-angle vector. Take the direction from the screen-space derivatives of the radius at the crossing that gave the most light, so the strokes follow the orbits even after the light has been bent around the hole. Zero it where neighbouring pixels see different things.
  - Render at 2 pixels per character cell into a mipmapped target, and read each cell from mip level 1.

  2. Characters
  - Cut the canvas into 8 px cells. The hole and empty space get no character.
  - The disk gets - ~ = by brightness, turned along the stored direction, so the orbits are traced by sideways strokes that bend around the hole. Stretch them to 0.84 of the cell's width so neighbours join into arcs. Read the direction from mip level 1.5, and guard the angle where the direction vector is zero, because atan(0, 0) is NaN on some GPUs.
  - Map brightness 0.06–0.85 across the glyphs with a gentle S-curve, and raise it to a power before picking the glyph (1.4 in dark mode, 1.2 in light), so most cells are the thin - and ~ and only the brightest get =.
  - Where gas or a star the visitor added makes most of the light, lift the cell to at least 60% and tint it toward a hotter colour.
  - Stars get upright . + * in their own colour, only in cells with no disk.
  - Draw the characters from a glyph atlas painted with the canvas 2D API in my site's monospace font, and repaint it once the font has loaded.

  3. Themes
  - Dark: the disk runs from deep red through orange and gold to near white. Added gas is a pale blue-white, and the stars a cool white.
  - Light: a pen drawing, with the ink densest where the disk is brightest, from pale ochre to dark brown. Added gas is indigo ink, and the stars a slate grey.
  - Update when my theme switch changes the theme.

  4. Feeding it
  - On pointer move, and on tap or drag on touch, trace the same bent ray in JavaScript and take its first crossing of the disk's plane between 0.9× the inner edge and 3 past the outer edge. Drop a clump of gas there every 24 px or 80 ms. Keep up to 48.
  - Each clump orbits at the disk's speed (6 turns per loop at the inner edge, falling off as r^−1.5) and falls inward over 6 s, r = r₀ − (r₀ − 2.85)(t/6)^1.6. Shear it as it goes, adding dΩ/dr each moment, so it smears into a spiral arc. It brightens as it falls, by up to 2.5×, and fades over the last 30% of its life.
  - On a click or tap, drop a star there: a glowing ball of radius 0.55, just above the disk, that orbits and shrinks away between 0.5 and 1.3 s. From 0.4 s it is torn into a thin stream, sheared three times faster than gas, that falls to the inner edge in 3.2 s. When it lands, the whole inner edge flares and fades. Keep up to 4.
  - Use touch-action: pan-y on the canvas, so vertical swipes still scroll the page.
  - Keyboard: Enter or Space on the focused canvas drops a star at a random point on the disk.

  5. Cost and accessibility
  - Draw at 30 fps normally, and every frame while gas or a star is alive. Stop when the canvas is off-screen or the tab is hidden.
  - Under prefers-reduced-motion, or when the WebGL renderer is a software one (SwiftShader, llvmpipe), draw one still frame and ignore the pointer.
  - If WebGL2 is missing, show a one-line fallback instead of throwing.
  - Give the canvas role="img" and a short aria-label.

  6. Done when
  - It loops every 12 s with no visible seam.
  - At a glance it reads as a black hole: a black shadow, the disk crossing in front of it, the far side bent into arcs above and below, a thin bright ring at the edge of the shadow, and one side brighter than the other.
  - A sweep leaves streaks of hot gas that wind inward and wrap around into the arcs. A click drops a star that is torn into a stream and lights up the inner edge when it lands.
  - Both themes look right, nothing is drawn outside the container, and the console is clean.
  - You tell me every file you added or changed.
---
