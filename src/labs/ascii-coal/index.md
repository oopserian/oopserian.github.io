---
title: ASCII Coal
summary: A wall of coal drawn entirely in ASCII characters, from a relief lit live in a shader that you never see. Sweep across it and it cracks open, lit from within.
tags: [WebGL, Shaders]
date: 2026-11-05
order: 11
prompt: |-
  Add an ASCII coal wall to my project: a relief of faceted coal lit live in a WebGL2 shader and shown only as ASCII characters, where the pointer cracks it open and cold blue light leaks out. Use raw WebGL2 with no 3D library: one engine file, plus a thin component in my existing framework. The canvas is transparent and fills its container; don't change my page's styles.

  0. Start from what exists
  - Find where the effect will live, which framework mounts it, and how my site switches between light and dark. Reuse that theme signal; don't add a new one.
  - If I already have WebGL helpers (context, shader compile, render targets), use them.

  1. The coal (offscreen)
  - Face the wall head-on, so the whole frame is coal. Make each lump about 0.32 of the canvas's short side, clamped to 110–190 px.
  - Lay the lumps out as a Voronoi pattern with jittered sites. For each pixel, find its lump, the distance to the nearest edge and that edge's direction (the two-pass method).
  - Carve each lump from a low dome with five facets that tilt outward and dip inward like gouged scoops, joined by a smooth minimum (k ≈ 0.045) so the ridges are soft. Let the rim fall steeply (slope 7) to a seam floor at −0.35. Carry the slope along with the height through every smooth minimum, so the normal is exact without finite differences.
  - Light it with a key light 35° up that swings across the top and back once per 12-second loop, plus a lamp hovering 0.9 above the pointer that fades in and out. Give each a diffuse term and a tight highlight, and darken the low parts (seams, cracks) as occlusion.
  - Store per pixel: the coal's brightness, how much blue light there is, and the direction of any seam or crack as a double-angle vector scaled by how line-like it is.
  - Render at 2 pixels per character cell into a mipmapped target, and read each cell from mip level 1.

  2. Characters
  - Cut the canvas into 8 px cells. Every cell gets a character.
  - Cells on a seam or crack get - \ | / picked by its direction, upright, stretched to touch the cell's edges so they join into lines, like classic ASCII art.
  - Other cells get . : + * # % @ by brightness: denser for brighter in dark mode, denser for darker in light mode, pushed toward dense since coal is black. Keep any random jitter from pushing an index below the first of these, or the darkest cells borrow the / before it.
  - Where the blue light is strong (seam junctions, the flash of a split), use the same characters in blue. Where it is faint, tint the characters next to it blue, so the light spills onto the edges.
  - Draw the characters from a glyph atlas painted with the canvas 2D API in my site's monospace font, and repaint it once the font has loaded. Sample the atlas at the mip level that matches the cell size; letting the GPU pick it draws a grey line between rows.

  3. Themes
  - Dark: the coal runs from dark to light grey, the seams are mid grey, and the light runs from ice blue to white.
  - Light: the coal runs from grey to ink, the seams are the darkest ink, and the light is my accent blue.
  - Update when my theme switch changes the theme.

  4. Cracks and light
  - At rest, a few spots of blue light drift along the seams. Take them from noise sampled on a circle that goes round once per loop, so they come back to where they started.
  - On pointer move, and on tap or drag on touch, keep the hits as a trail of up to 64 points with their times. The newest point follows the pointer; fix it and start another every 28 px or 90 ms. A pause of over 250 ms, or leaving the canvas, starts a new stroke. When the trail is full, drop the middle point that sits most nearly on a line with its neighbours, never a stroke's first or last point. Drop points after 4 s.
  - Along the trail, open a crack about a cell wide, measured from a point nudged by noise so it zigzags. It glows, fades as it ages, and closes from the oldest end. Light up the seams near the trail too, reaching further along them as the trail ages (0.2 + 0.55 × age^0.7 lumps) and dimming over about 1.6 s.
  - On a click or tap, split the coal there: 3 to 5 cracks run out in random directions within 0.2 s, each in three segments that turn a little and taper, with one short branch, plus a flash at the centre. They glow, then close by 4 s. Keep up to 6 of these.
  - Use touch-action: pan-y on the canvas, so vertical swipes still scroll the page.
  - Keyboard: Enter or Space on the focused canvas splits a random spot.

  5. Cost and accessibility
  - Draw at 30 fps normally, and every frame while a crack or trail is alive or the lamp is moving. Stop when the canvas is off-screen or the tab is hidden.
  - Under prefers-reduced-motion, or when the WebGL renderer is a software one (SwiftShader, llvmpipe), draw one still frame and ignore the pointer.
  - If WebGL2 is missing, show a one-line fallback instead of throwing.
  - Give the canvas role="img" and a short aria-label.

  6. Done when
  - It loops every 12 s with no visible seam.
  - A sweep leaves a zigzag glowing crack that follows its path and closes from the oldest end, and a click splits the coal into an uneven burst of cracks, not a symmetric star.
  - Both themes look right, nothing is drawn outside the container, and the console is clean.
  - You tell me every file you added or changed.
---
