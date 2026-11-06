---
title: ASCII Sand
summary: A dune field drawn entirely in ASCII characters, from a desert lit live in a shader that you never see. Sweep across the sand to carve a groove that the wind slowly fills.
tags: [WebGL, Shaders]
date: 2026-11-06
order: 12
prompt: |-
  Add an ASCII dune field to my project: a desert seen from a camera standing on the dunes, lit live in a WebGL2 shader and shown only as ASCII characters, where the pointer carves grooves that the wind fills back in and a click pours a little pile of sand that the wind blows away. Use raw WebGL2 with no 3D library: one engine file, plus a thin component in my existing framework. The canvas is transparent and fills its container; don't change my page's styles.

  0. Start from what exists
  - Find where the effect will live, which framework mounts it, and how my site switches between light and dark. Reuse that theme signal; don't add a new one.
  - If I already have WebGL helpers (context, shader compile, render targets), use them.

  1. The desert (offscreen)
  - The camera stands 1.1 units above the sand, with a 44° vertical field of view (widened so the horizontal view is at least 40° on narrow screens). Tilt it down so the horizon sits at 0.7 in clip space, about a seventh of the way down the frame; above it is sky.
  - The wind blows away from the camera and slightly to the right, along (0.25, −1). Measure everything along the wind and across it.
  - Lay the dunes as ridges across the wind, one every 2.3 units. Each rises gently on the windward side (x²(1.6 − 0.6x)) to a sharp crest 74% of the way along, then drops down a steep slip face ((1 − y)^1.4). Bend the crest line across the wind with two sines and some noise, vary each dune's height (0.42, times 0.55–1.35 from noise), and lay a slow swell under everything (0.45 × noise at 0.09 per unit).
  - Hash the noise lattice with integer maths (uvec2 multiplies and xor), not sin(), so JavaScript can reproduce it exactly with Math.imul for the pointer.
  - For every pixel, march a ray onto the height field: up to 140 steps, each max(0.4 × the height above the sand, 0.0025 × the distance so far), and interpolate the crossing between the last two steps. A ray that gets 70 units without hitting is sky.
  - Cover the windward slopes and the troughs with ripples 0.11 units apart, using the same lopsided profile with the crest at 68%, bent a little with sines and noise. Leave them off the crest and the slip face, where sand keeps sliding. They move exactly one ripple downwind per 12-second loop. Add their slope to the lighting only where a ripple spans more than about 6 pixels of the offscreen target, fading it out by 2.5 pixels, or the distance turns to noise; keep their direction for the characters further out.
  - Light it with a low sun behind the camera on the left, 9° up: a diffuse term softened by a soft shadow (22 steps toward the sun, each 1.28× longer than the last, starting at 0.03), plus sky light from the opposite side so the shaded slopes still show their ripples. Haze it toward the sky's brightness at the horizon by 1 − exp(−distance / 4.5).
  - The sky darkens upward from a bright band of dust on the horizon, with a glow and a small disc where the sun is.
  - Let the wind lift wisps of sand off the crests near the camera and carry them downwind. Take them from noise that repeats along the wind and slides exactly one repeat per loop.
  - Store per pixel: the brightness, how much blown sand there is, and the direction the characters should run on screen, as a double-angle vector: along the ripples where there are ripples, along the dune's contour elsewhere, along the groove inside a groove. Project the direction on the ground into screen space through the camera.
  - Render at 2 pixels per character cell into a mipmapped target, and read each cell from mip level 1.

  2. Characters
  - Cut the canvas into 8 px cells. Every cell gets a character.
  - Sand gets - ~ = by brightness, turned along the stored direction, so each ripple and dune is traced by sideways strokes that converge with the perspective. Stretch them to 0.84 of the cell's width so neighbours join into lines. Read the direction from a blurrier mip level (2.5) than the brightness, so it doesn't jitter with every small bump, and guard the angle where the direction vector is zero, because atan(0, 0) is NaN on some GPUs.
  - Map brightness 0.31–0.62 across the glyphs, push it through a gentle S-curve for contrast, and raise it to a power before picking the glyph (1.8 in dark mode), so most cells are the thin - and ~ and only the brightest get =. The colour ramp carries most of the tone.
  - Blown sand gets upright . : * in its own colour, with a few stray grains around it.
  - Draw the characters from a glyph atlas painted with the canvas 2D API in my site's monospace font, and repaint it once the font has loaded.

  3. Themes
  - Dark: dusk. Shaded sand is a dusty violet, sunlit sand runs through rose and amber to pale gold, and blown sand is near white.
  - Light: a pen drawing. The sand runs from pale sand to dark brown, denser for darker, so the shadows are thick with ink; blown sand is a mid brown.
  - Update when my theme switch changes the theme.

  4. Grooves and piles
  - On pointer move, and on tap or drag on touch, march a ray from that pixel onto the same dunes in JavaScript (ripples, grooves and piles aside) and keep the hits as a trail of up to 64 points with their times. A hit in the sky ends the stroke. The newest point follows the pointer; fix it and start another every 28 px or 90 ms. A pause of over 250 ms, or leaving the canvas, starts a new stroke. When the trail is full, drop the middle point that sits most nearly on a line with its neighbours, never a stroke's first or last point. Drop points after 6 s.
  - Along the trail, carve a groove with a half-width of 0.05 units. For each pixel, use the segment that matters most there (the nearest, weighted by how fresh it is), measured from a point nudged by noise so the edges are ragged. Its cross-section is a pit 0.9 × its half-width deep, with a berm on each side 0.35 of that high, 1.75 half-widths out. Compute its slope along with its height.
  - The wind fills the groove back in: it starts after 0.8 s, is gone by 6 s, and the groove spreads to 1.6× its width as it fills. Wipe the ripples inside the groove and on its berms, and let them grow back as it fills. For the first 0.7 s, kick grains up along the fresh stretch, picked per screen cell so they read as grains.
  - On a click or tap, pour a pile there: a cone with a radius of 0.2 units and a rounded tip that builds up over 0.45 s, with grains falling around it for the first 0.6 s. After 1 s the wind takes it: it drifts 1.4 radii downwind, stretches to 2.3× along the wind, flattens to nothing by 5 s, and trails wisps of blown sand. Piles hide the ripples under them and cast shadows. Keep up to 6.
  - If the stroke just started with a lone point where the pile lands, drop that point, so the pile doesn't sit in a pit.
  - Use touch-action: pan-y on the canvas, so vertical swipes still scroll the page.
  - Keyboard: Enter or Space on the focused canvas pours a pile at a random spot on the near sand.

  5. Cost and accessibility
  - Draw at 30 fps normally, and every frame while a groove or pile is alive. Stop when the canvas is off-screen or the tab is hidden.
  - Under prefers-reduced-motion, or when the WebGL renderer is a software one (SwiftShader, llvmpipe), draw one still frame and ignore the pointer.
  - If WebGL2 is missing, show a one-line fallback instead of throwing.
  - Give the canvas role="img" and a short aria-label.

  6. Done when
  - It loops every 12 s with no visible seam.
  - At a glance it reads as dunes in perspective: lit windward slopes striped with ripples, dark slip faces, long shadows, haze toward the horizon.
  - A sweep carves a groove with a raised berm on each side that the wind fills in within 6 s, and the ripples come back. A click piles a small cone that blows away downwind.
  - Both themes look right, nothing is drawn outside the container, and the console is clean.
  - You tell me every file you added or changed.
---
