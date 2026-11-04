---
title: ASCII Waves
summary: An open sea drawn live with Three.js, with a layer of ASCII characters over the water. Move across it and rings ripple out.
tags: [WebGL, Three.js, Shaders]
date: 2026-11-04
order: 10
---

The sea is a real 3D scene, set up with Three.js and drawn by hand-written shaders into an offscreen image. The sky comes first: a gradient from a hazy horizon to a deeper zenith, with a low sun straight ahead, or a moon in dark mode. Then the water: a grid that runs from just under the camera to the horizon, dense nearby and sparse far away. Ten Gerstner waves move each vertex, so the crests come up sharp and the troughs stay flat, and where crests get squeezed together they turn white with foam. Eight finer waves only bend the surface normals, which breaks the sun's reflection into a glittering path. Finer waves are faded with distance before they would shimmer, and haze swallows the sea toward the horizon.

The ASCII sits on top of that image rather than replacing it. The screen is cut into 8 × 14 cells, and each cell reads the average brightness of the sea under it and picks a character from `. - ~ = + * # % @`, faint to dense. The character takes the colour of its cell lifted toward white, and the sea underneath is only dimmed a little, so you see both at once: bright crests and the sun's path come out as `#` and `@`, troughs as dots. The open sky stays clear; only the sun or moon and its glow turn into characters. Switching between Waves and ASCII wipes across from left to right.

Moving over the water casts a ray from the cursor onto the sea, and where it lands a ring ripples outward and fades within a few seconds; a tap does the same. Every wave completes a whole number of cycles in 12 seconds, so the sea loops seamlessly. It runs at 30 frames a second, at full rate only while ripples spread or the layers switch, stops when it scrolls out of view, and draws a single still frame when reduced motion is on or the GPU is emulated in software.
