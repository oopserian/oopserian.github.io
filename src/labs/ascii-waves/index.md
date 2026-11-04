---
title: ASCII Waves
summary: Ocean waves drawn entirely in ASCII characters, from a 3D sea rendered live in a shader that you never see. Move across the water and rings ripple out.
tags: [WebGL, Shaders]
date: 2026-11-04
order: 10
prompt: |-
  Add an ASCII sea to my project: a 3D ocean rendered live in a WebGL2 shader and shown only as ASCII characters, with ripples wherever the pointer moves. Use raw WebGL2 with no 3D library: one engine file, plus a thin component in my existing framework. The canvas is transparent and fills its container; don't change my page's styles.

  0. Start from what exists
  - Find where the effect will live, which framework mounts it, and how my site switches between light and dark. Reuse that theme signal; don't add a new one.
  - If I already have WebGL helpers (context, shader compile, render targets), use them. Write the perspective and look-at matrices yourself; each is a few lines.

  1. The sea (offscreen)
  - The camera is 11 m up, looking 40° down with a 50° vertical field of view, so the whole frame is water and there is no sky.
  - The surface is a 300×400 grid laid out exponentially: dense at the camera's feet, sparse in the distance, and wider the farther it goes, so it always covers the frame. It has more than 65,535 vertices, so use 32-bit indices.
  - In the vertex shader, move it with ten Gerstner waves, most heading toward the camera with a crossing swell, so the crests are sharp and the troughs flat. In the fragment shader, add eight small waves that only bend the normal.
  - Give every wave a whole number of cycles in 12 seconds, picked as the nearest whole number to the deep-water dispersion ω = √(gk), so the sea returns exactly to where it started and loops with no seam.
  - Store per pixel: the water's brightness (crests brighter than troughs, faces toward the light and reflections brighter, the distance hazed toward the middle), the direction of the crest on screen as a double-angle vector, and how much foam there is.
  - Foam gathers in clumps along the crests of the three biggest waves and trails off behind them; each clump flares up and dies on its own. It also appears where crests pinch together (where the Jacobian gets small) and on the ripple rings.
  - Render into a target with depth and mipmaps, and read each cell from the mip level that matches the cell size.

  2. Characters
  - Cut the canvas into 8 px cells. Every cell gets a character.
  - Cells with enough foam get an upright . : * o @, denser for more foam, with a few stray dots around the foam as spray.
  - Other cells get - ~ = by brightness, turned along the crest direction, so each wave is traced by sideways strokes. Guard the angle where the direction vector is zero, because atan(0, 0) is NaN on some GPUs.
  - Draw the characters from a glyph atlas painted with the canvas 2D API in my site's monospace font. Repaint it once the font has loaded.

  3. Themes
  - Dark: the water runs along a ramp from deep to pale blue, and the foam from pale blue to white.
  - Light: the water runs from grey-blue to navy, and the foam is the darkest ink.
  - Update when my theme switch changes the theme.

  4. Ripples
  - On pointer move, and on tap or drag on touch, cast a ray from that pixel onto the sea and start a ring of ripples where it lands. Add one every 40 px or 120 ms of movement, up to 8 at once. Each spreads outward and settles within a few seconds.
  - Use touch-action: pan-y on the canvas, so vertical swipes still scroll the page.
  - Keyboard: Enter or Space on the focused canvas starts a ripple at a random spot.

  5. Cost and accessibility
  - Draw at 30 fps normally, and every frame while a ripple is running. Stop when the canvas is off-screen or the tab is hidden.
  - Under prefers-reduced-motion, or when the WebGL renderer is a software one (SwiftShader, llvmpipe), draw one still frame and ignore the pointer.
  - If WebGL2 is missing, show a one-line fallback instead of throwing.
  - Give the canvas role="img" and a short aria-label.

  6. Done when
  - It loops every 12 s with no visible seam.
  - The edges of the sea never show, even at the crests.
  - Both themes look right, nothing is drawn outside the container, and the console is clean.
  - You tell me every file you added or changed.
---
