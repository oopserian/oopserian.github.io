---
title: ASCII Clouds
summary: Cumulus clouds drawn entirely in ASCII characters, from a sky raymarched live in a shader that you never see. Sweep through them to part the clouds.
tags: [WebGL, Shaders]
date: 2026-11-02
order: 9
prompt: >-
  Build an ASCII-art sky in raw WebGL2 (no 3D library) as a React component that fills its container. Offscreen,
  raymarch a layer of cumulus between 1 and 2.6 km, seen from the ground with the horizon just below the frame:
  a 2D fbm coverage map drifting toward the camera (crossfade two offset copies so it loops every 12 seconds),
  flat bases, tops that climb where the cloud is thicker, edges eroded by a tiling 3D Worley texture, 48 steps
  with three light samples toward the sun, and haze in the distance. Render it at two pixels per 8px cell. Then
  draw one character per cell from . : - = + * # % @ by brightness, the sky only . : - and the clouds the rest,
  turned along the brightness contours. Dark theme is dusk, the sun just under the horizon and the cloud edges
  gold and pink, each character in the colour of its cloud; light theme is midday, with denser characters in
  darker navy ink. Keep the canvas transparent. Sweeping the pointer parts a ragged hole that drifts with the
  wind and closes within a few seconds. Run at 30fps, stop off-screen, and draw one still frame under reduced
  motion or software rendering.
---
