---
title: ASCII Sand
summary: Sand dunes drawn entirely in ASCII characters, from a desert lit live in a shader that you never see. Sweep across it to carve a groove that the wind slowly fills.
tags: [WebGL, Shaders]
date: 2026-11-06
order: 12
prompt: |-
  Add an ASCII sand dune field to my project: desert dunes seen from straight above, lit live in a WebGL2 shader and shown only as ASCII characters, where the pointer carves grooves that the wind fills back in and a click pours a little pile of sand that the wind blows away. Use raw WebGL2 with no 3D library: one engine file, plus a thin component in my existing framework. The canvas is transparent and fills its container; don't change my page's styles.

  0. Start from what exists
  - Find where the effect will live, which framework mounts it, and how my site switches between light and dark. Reuse that theme signal; don't add a new one.
  - If I already have WebGL helpers (context, shader compile, render targets), use them.

  1. The sand (offscreen)
  - Look straight down, so the whole frame is sand. One unit of sand is 0.42 of the canvas's short side, clamped to 120–300 px.
  - The wind blows down the screen and slightly to the right, direction (0.14, −0.99). Measure everything along the wind and across it.
  - Lay the dunes as ridges across the wind, one every 1.25 units. Each rises gently on the windward side (x²(1.6 − 0.6x)) to a sharp crest 72% of the way along, then drops down a steep slip face ((1 − y)^1.4). Bend the crest line across the wind with two sines and some noise, and vary each dune's height (0.13, times 0.7–1.3 from noise).
  - Cover the windward slopes and the troughs with small ripples 40 px apart, using the same lopsided profile with the crest at 68% and a height of 0.09 of their spacing, bent a little with sines and noise. Leave them off the crest and the slip face, where sand keeps sliding. They move exactly one ripple downwind per 12-second loop.
  - Light it with a low sun from the upper left, 21° up: a diffuse term plus a little sky light. Exaggerate the dunes' slope 2.2× for the lighting only, so the relief reads from above. Cast soft shadows by stepping 14 times toward the sun and checking whether a dune or a pile is in the way.
  - Let the wind lift wisps of sand off the crests and carry them downwind. Take them from noise that repeats every 8 cells along the wind and slides one repeat per loop.
  - Store per pixel: the sand's brightness, how much blown sand there is, and the direction of any line (ripple crest, dune crest, slip-face streak, groove berm, pile rim) as a double-angle vector scaled by how line-like it is.
  - Render at 2 pixels per character cell into a mipmapped target, and read each cell from mip level 1.

  2. Characters
  - Cut the canvas into 8 px cells. Every cell gets a character.
  - Cells on a line get ~ \ | / picked by its direction, upright, like classic ASCII art. Stretch \ | / to touch the cell's edges so they join, stretch ~ to the full width and 1.6× taller so its wave shows, and draw the lines with a thicker stroke than the other characters so they hold up against the grains.
  - Make the dune crests the brightest thing on the sand. Draw the ripple crests only in patches chosen by noise, and slightly darker (×0.7) than the sand around them; drawn everywhere, they look like ruled paper and hide the dunes. Give the slip faces sparse streaks running down the wind.
  - Other cells get . , : ; + * # by brightness: denser for brighter in dark mode, denser for darker in light mode. Keep any random jitter from pushing an index below the first of these, or the darkest cells borrow the / before it.
  - Blown sand gets . : * in its own colour, unless the cell is strongly on a line.
  - Draw the characters from a glyph atlas painted with the canvas 2D API in my site's monospace font, and repaint it once the font has loaded. Sample the atlas at the mip level that matches the cell size; letting the GPU pick it draws a grey line between rows.

  3. Themes
  - Dark: dusk. Shaded sand is a dusty violet grey, sunlit sand runs from amber to pale gold, and blown sand is near white.
  - Light: noon. The sand runs from pale sand to dark brown, and blown sand is a mid brown.
  - Update when my theme switch changes the theme.

  4. Grooves and piles
  - On pointer move, and on tap or drag on touch, keep the hits as a trail of up to 64 points with their times. The newest point follows the pointer; fix it and start another every 28 px or 90 ms. A pause of over 250 ms, or leaving the canvas, starts a new stroke. When the trail is full, drop the middle point that sits most nearly on a line with its neighbours, never a stroke's first or last point. Drop points after 6 s.
  - Along the trail, carve a groove. For each pixel, use the segment that matters most there (the nearest, weighted by how fresh it is), measured from a point nudged by noise so the edges are ragged. Its cross-section is a pit 0.9 × its half-width deep (half-width 13 px), with a berm on each side 0.35 of that high, 1.75 half-widths out. Compute its slope along with its height.
  - The wind fills the groove back in: it starts after 0.8 s, is gone by 6 s, and the groove spreads to 1.6× its width as it fills. Wipe the ripples inside the groove and on its berms, and let them grow back as it fills. Draw the berm crests as lines along the groove.
  - On a click or tap, pour a pile there: a cone with a 46 px radius and a rounded tip that builds up over 0.45 s, with grains flickering around it for the first 0.6 s (pick them per screen cell, so they read as falling grains). After 1 s the wind takes it: it drifts 1.4 radii downwind, stretches to 2.3× along the wind, flattens to nothing by 5 s, and trails wisps of blown sand. Outline its base with a line that fades as it stretches. Piles hide the ripples under them and cast shadows. Keep up to 6.
  - If the stroke just started with a lone point where the pile lands, drop that point, so the pile doesn't sit in a pit.
  - Use touch-action: pan-y on the canvas, so vertical swipes still scroll the page.
  - Keyboard: Enter or Space on the focused canvas pours a pile at a random spot.

  5. Cost and accessibility
  - Draw at 30 fps normally, and every frame while a groove or pile is alive. Stop when the canvas is off-screen or the tab is hidden.
  - Under prefers-reduced-motion, or when the WebGL renderer is a software one (SwiftShader, llvmpipe), draw one still frame and ignore the pointer.
  - If WebGL2 is missing, show a one-line fallback instead of throwing.
  - Give the canvas role="img" and a short aria-label.

  6. Done when
  - It loops every 12 s with no visible seam.
  - At a glance it reads as a dune field: bright crest lines, shaded slip faces, patches of ripples, not a sheet of ruled lines.
  - A sweep carves a groove with a raised berm on each side that the wind fills in within 6 s, and the ripples come back. A click piles a small cone that blows away downwind.
  - Both themes look right, nothing is drawn outside the container, and the console is clean.
  - You tell me every file you added or changed.
---
