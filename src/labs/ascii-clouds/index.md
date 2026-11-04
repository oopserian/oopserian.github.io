---
title: ASCII Clouds
summary: Cumulus clouds drawn entirely in ASCII characters, from a sky raymarched live in a shader that you never see. Sweep through them to part the clouds.
tags: [WebGL, Shaders]
date: 2026-11-02
order: 9
prompt: |-
  Add an ASCII cloud sky to my project: cumulus clouds rendered live in a WebGL2 shader, shown only as ASCII characters, that part when the pointer sweeps through them. Use raw WebGL2 with no 3D library: one engine file, plus a thin component in my existing framework. The canvas is transparent and fills its container; don't change my page's styles.

  0. Start from what exists
  - Find where the effect will live, which framework mounts it, and how my site switches between light and dark. Reuse that theme signal; don't add a new one.
  - If I already have WebGL helpers (context, shader compile, render targets), use them.

  1. The sky (offscreen, low resolution)
  - The camera stands on the ground looking forward and up. The bottom edge of the frame sits just above the horizon, so the whole frame is sky.
  - Coverage: a 512×256 texture covering the sky in view (60 km to each side, 62 km ahead), filled with 5-octave value-noise fbm at 0.32 per km. Each loop, the wind carries it 4 km toward the camera and 1.5 km to the right. To loop every 12 s with no seam, sample the same noise twice, one loop apart, crossfade them by time, and restore the contrast the blend loses.
  - Clouds: for each pixel, raymarch 48 steps through a layer from 1 to 2.6 km up. Give the clouds flat bases, with tops that climb where the coverage is thicker. Erode the edges with a tileable 32³ texture of three inverted Worley octaves so they bulge like cumulus. At each step, take 3 samples toward the sun for shadow and add sky light. Fade distance into the horizon colour with exp(-distance / 45 km).
  - Render this draft at only 2 pixels per character cell into a mipmapped render target. Nobody sees it directly.

  2. Characters
  - Cut the canvas into 8 px cells. Every cell gets a character; none is left empty.
  - Pick from . : - = + * # % @ by brightness. The sky uses only . : - and the clouds use the rest.
  - Turn each character along the brightness contour, perpendicular to the gradient across neighbouring cells, so the strokes flow around each cloud. Guard the angle where the gradient is zero, because atan(0, 0) is NaN on some GPUs.
  - Draw the characters from a glyph atlas painted with the canvas 2D API in my site's monospace font. Repaint it once the font has loaded.

  3. Themes
  - Dark is dusk. The sun sits just below the horizon, ahead and to the right. Cloud edges are lit gold, then pink, and the shadowed sides are purple. Each character takes the colour of its patch of cloud.
  - Light is daytime: the sun is behind the camera, with a blue sky and white clouds. Characters are inked in four navy tones from pale to dark by density, so the clouds read as dark-blue masses, not holes in white.
  - Update when my theme switch changes the theme.

  4. Parting the clouds
  - On pointer move, and on tap or drag on touch, cast a ray from that pixel to the middle of the cloud layer (1.8 km up) and keep the hits as a trail of up to 48 points that drift with the wind. The newest point follows the pointer; fix it and start another every 40 px or 120 ms. A pause of over 250 ms, or leaving the canvas, starts a new stroke. A tap is a stroke of its own and cuts wider.
  - Each frame, turn the points into view directions. Per pixel, find the nearest point on each stroke's polyline (on the sphere of directions) and divide the angle by the groove's half-width there: about 0.085 rad for a stroke and 0.13 for a tap, varied by ±15% per point so the sides aren't parallel. So a sweep cuts a groove that follows its path, not a row of round holes.
  - Rag the groove's edge with two scales of the detail noise, sampled where the ray crosses the middle of the layer (sampled along the ray, the noise averages out and the edge goes smooth again). Leave a few torn scraps inside near the edge, and make the clouds just outside the edge denser, as if pushed aside. Apply the cut and the rim to every sample on that ray, light samples included.
  - The groove opens in 0.2 s. From 0.8 s to 4 s it fills back in: the puffiest parts (high noise) come back first, so it closes in wisps rather than shrinking evenly, while the edge creeps in a little. Drop points after 4 s.
  - Use touch-action: pan-y on the canvas, so vertical swipes still scroll the page.
  - Keyboard: Enter or Space on the focused canvas parts a random patch.

  5. Cost and accessibility
  - Draw at 30 fps normally, and every frame while a groove is open. Stop when the canvas is off-screen or the tab is hidden.
  - Under prefers-reduced-motion, or when the WebGL renderer is a software one (SwiftShader, llvmpipe), draw one still frame and ignore the pointer.
  - If WebGL2 is missing, show a one-line fallback instead of throwing.
  - Give the canvas role="img" and a short aria-label.

  6. Done when
  - It loops every 12 s with no visible seam.
  - A sweep leaves one ragged groove that follows its curve and fills back in wisps, oldest end first; a tap tears an uneven hole, not a circle.
  - Both themes look right, nothing is drawn outside the container, and the console is clean.
  - You tell me every file you added or changed.
---
