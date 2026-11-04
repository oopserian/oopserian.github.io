---
title: ASCII Grass
summary: 160,000 blades of grass steered like a school of fish, with ASCII characters on top that turn with the blades. Brush through it and the grass parts, then settles back.
tags: [WebGL, Three.js, Shaders]
date: 2026-11-04
order: 10
---

Three full-screen passes run on the GPU every frame, set up with Three.js. The first draws a small 192 × 144 direction field: which way the grass leans at each point and how flat it lies. It moves like a school of fish. The whole meadow swings slowly left and right, a large noise layer turns big patches together and a smaller one makes neighbouring patches disagree a little. Gusts are diagonal bands that sweep through twice a cycle, and the grass under them lies flatter, looks longer from above and catches more light.

The second pass draws 160,000 blades, one instance each. Every blade has its own root on a meadow painted once at start, and takes the colour under that root. Its direction is the field's direction at the root, plus a small angle of its own and a sway with its own phase. A blade is a four-segment curve, wide at the root and pointed at the tip, dark at the root and bright at the tip, with a little sheen when it faces the light. The blades go into an offscreen image with mipmaps.

The third pass cuts the screen into 9-pixel cells. Each cell reads the average colour of the blades under it from the mipmap and picks a character by brightness, from fine dots in the shade to bold strokes in the light: `. : i ! l |` and a heavy `|`. The character is then rotated so its upright stroke follows the field, which is why the letters turn with the grass. Switching between Blades and ASCII wipes across from left to right.

Moving the cursor leaves a short trail that pushes the field outward and along the stroke, so the grass parts where you brush and springs back within a second or so; a tap or a click parts it in a ring. Everything is a function of a 12-second cycle, with noise that loops and sines that complete whole turns, so the motion repeats seamlessly. It runs at 30 frames a second, at full rate only while you brush or switch layers, stops when it scrolls out of view, and draws a single still frame when reduced motion is on or the GPU is emulated in software. Drop an image on the screen to grow the grass in its colours instead.
