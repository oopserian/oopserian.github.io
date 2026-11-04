---
title: ASCII Waves
summary: Ocean waves drawn entirely in ASCII characters, from a 3D sea rendered live in a shader that you never see. Move across the water and rings ripple out.
tags: [WebGL, Shaders]
date: 2026-11-04
order: 10
prompt: >-
  Build an ASCII-art sea in raw WebGL2 (no 3D library) as a React component that fills its container. Offscreen,
  render a 3D ocean seen from 11m up, looking 40° down so there is no sky: a 300×400 grid, dense near the camera
  and sparse far away, moved by ten Gerstner waves, plus eight small waves that only bend the normals. Store per
  pixel the water's brightness, the crest's direction on screen as a double-angle vector, and foam: clumps along
  the crests of the three biggest waves that trail off behind them and flare up and die on their own. Give every
  wave a whole number of cycles in 12 seconds so the loop is seamless. Then cut the screen into 8px cells: foam
  cells get an upright . : * o @, water cells get - ~ = by brightness, turned along the crest. Dark theme runs
  deep to pale blue with white foam; light theme runs grey-blue to navy with the darkest ink for foam. Keep the
  canvas transparent. Moving the pointer casts a ray onto the sea and sends out a ring of ripples. Run at 30fps,
  stop off-screen, and draw one still frame under reduced motion or software rendering.
---
