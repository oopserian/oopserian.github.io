---
title: ASCII Coal
summary: A bed of coal drawn entirely in ASCII characters, from lumps lit live in a shader that you never see. Sweep across it and it cracks open, lit from within.
tags: [WebGL, Shaders]
date: 2026-11-05
order: 11
prompt: |-
  Add an ASCII coal bed to my project: a bed of faceted coal lumps seen at an angle, lit live in a WebGL2 shader and shown only as ASCII characters, where the pointer cracks it open and cold blue light leaks out. Use raw WebGL2 with no 3D library: one engine file, plus a thin component in my existing framework. The canvas is transparent and fills its container; don't change my page's styles.

  0. Start from what exists
  - Find where the effect will live, which framework mounts it, and how my site switches between light and dark. Reuse that theme signal; don't add a new one.
  - If I already have WebGL helpers (context, shader compile, render targets), use them.

  1. The coal bed
  - Measure everything in lumps: one Voronoi cell is one lump, with its site jittered within 0.14–0.86 of the cell. For each point, find its lump, the distance to the nearest edge and that edge's direction (the two-pass method, 3×3 then 5×5). Hash the lattice with integer maths, not sin(), so every GPU agrees.
  - Carve each lump from a low dome (1 + 0.2 × random − 0.5r²) with five facets that tilt outward and dip inward like gouged scoops, joined by a smooth minimum (k ≈ 0.045) so the ridges are soft. Let the rim fall with slope 4 to a seam floor at −0.35 that is flat for 0.03 from the edge (k ≈ 0.08). Scale the heights by 0.6 and lay the whole bed on a slow heave (0.6 × noise at 0.16 per lump). Carry the slope along with the height through every smooth minimum, so the normal is exact without finite differences.
  - The camera hangs 3.4 lumps above the bed, with a 44° vertical field of view (widened so the horizontal view is at least 40° on narrow screens), looking 42° down, and at least the half field of view plus 14°, so the top edge still looks at coal and there is no sky. On narrow canvases raise it by up to 1.6× (1.2 ÷ aspect), so the lumps aren't huge.
  - The coal never moves, so march the rays only when the size changes. Start each ray where it enters the top of the bed's height range. March first on a cheap upper bound (the nearest and second-nearest sites only, the dome without its facets, the rim measured from the bisector of those two sites, which is never nearer than the real edge), then on the full height, then bisect six times between the last point above and the first below. Store where each ray landed: x and z as 16 bits each, split across the four channels of an RGBA8 target.
  - Read that target back the first time the pointer needs it, and look up where the pointer lands from it, instead of marching again in JavaScript.

  2. Light (every frame)
  - Recompute the height and slope at each stored point, and light it as glossy black coal: a little ambient, a fill from the camera's side (0.15), weak diffuse (0.35), the sky reflected in faces that tip up (0.45 × the reflection's upward part × a Fresnel term), and a tight highlight (power 50). Most of the brightness comes from reflections.
  - The key light is 29° up and swings ±63° around straight behind the bed once per 12-second loop, so faces flash one after another and the highlights slide across them. A lamp hangs at height 1.3 over the pointer's spot (falloff 1 / (1 + 2.5d²)), follows it with easing, and fades in and out.
  - Darken low ground (seams, the bases of lumps, cracks) as occlusion. Past 7 lumps away, fade toward the background: to black in dark mode, to paper in light mode.
  - Cold blue light lives in the seams. At rest, a few patches of it drift along the seams: take them from noise sampled on a circle that goes round once per loop, so they come back to where they started, and flicker each lump's share three times per loop. It is strongest on the seam floor and climbs up the lumps' lower flanks.
  - Store per pixel: the brightness, how much blue light there is, and the direction the characters should run on screen: along the surface's contour line, projected into screen space through the camera, as a double-angle vector scaled by how steep the face is; along the crack inside a crack.
  - Render at 2 pixels per character cell into a mipmapped target, and read each cell from mip level 1.

  3. Characters
  - Cut the canvas into 8 px cells. Every cell gets a character.
  - Coal gets - = by brightness, turned along the stored direction, so each face is hatched in its own direction and the lumps' edges show where the direction changes. Stretch them to 0.84 of the cell's width so neighbours join. Read the direction from mip level 2, and guard the angle where the direction vector is zero, because atan(0, 0) is NaN on some GPUs.
  - Map brightness 0.04–0.5 across the glyphs and lift the darks with a power (0.6 in dark mode, 0.8 in light mode), since coal is mostly dark. Turn the strokes in the darkest cells level, like the hatching in an engraving's shadows, and let only the lit faces follow their contours.
  - Blue light tints the strokes and makes them denser. Where it is strongest (a crack's flash, a fresh split), use upright . : * o @ instead. In dark mode, scatter an upright * over the brightest highlights.
  - Draw the characters from a glyph atlas painted with the canvas 2D API in my site's monospace font, and repaint it once the font has loaded.

  4. Themes
  - Dark: the coal runs from a near-black blue grey to pale grey, denser for brighter; the light runs from ice blue to white.
  - Light: the coal runs from grey to ink, denser for darker, so the lit faces are what's left pale; the light is a deep version of my accent blue.
  - Update when my theme switch changes the theme.

  5. Cracks and light
  - On pointer move, and on tap or drag on touch, keep the hits as a trail of up to 64 points with their times. The newest point follows the pointer; fix it and start another every 28 px or 90 ms. A pause of over 250 ms, or leaving the canvas, starts a new stroke. When the trail is full, drop the middle point that sits most nearly on a line with its neighbours, never a stroke's first or last point. Drop points after 4 s.
  - Along the trail, open a crack about a cell wide (measure a cell on the coal from the distance), from a point nudged by noise so it zigzags. It glows, fades as it ages, and closes from the oldest end. Light up the seams near the trail too, reaching further along them as the trail ages (0.2 + 0.55 × age^0.7 lumps) and dimming over about 1.6 s.
  - On a click or tap, split the coal there: 3 to 5 cracks run out in random directions within 0.2 s, each in three segments that turn a little and taper, with one short branch, plus a flash at the centre. They glow, then close by 4 s. Keep up to 6 of these.
  - Use touch-action: pan-y on the canvas, so vertical swipes still scroll the page.
  - Keyboard: Enter or Space on the focused canvas splits a random spot.

  6. Cost and accessibility
  - Draw at 30 fps normally, and every frame while a crack or trail is alive or the lamp is moving. Stop when the canvas is off-screen or the tab is hidden.
  - Under prefers-reduced-motion, or when the WebGL renderer is a software one (SwiftShader, llvmpipe), draw one still frame and ignore the pointer.
  - If WebGL2 is missing, show a one-line fallback instead of throwing.
  - Give the canvas role="img" and a short aria-label.

  7. Done when
  - It loops every 12 s with no visible seam.
  - At a glance it reads as a heap of lumps in perspective: faces hatched in different directions, flashing as the light swings, blue light down in the seams.
  - A sweep leaves a zigzag glowing crack that follows its path and closes from the oldest end, and a click splits the coal into an uneven burst of cracks, not a symmetric star.
  - Both themes look right, nothing is drawn outside the container, and the console is clean.
  - You tell me every file you added or changed.
---
