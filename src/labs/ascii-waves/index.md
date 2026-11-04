---
title: ASCII Waves
summary: Ocean waves drawn entirely in ASCII characters, from a sea rendered live with Three.js that you never see. Move across the water and rings ripple out.
tags: [WebGL, Three.js, Shaders]
date: 2026-11-04
order: 10
---

Underneath the characters is a real 3D sea, set up with Three.js and drawn by hand-written shaders into an offscreen image that never reaches the screen. The sky comes first: a gradient from a hazy horizon to a deeper zenith, with a low sun straight ahead, or a moon in dark mode. Then the water: a grid that runs from just under the camera to the horizon, dense nearby and sparse far away. Ten Gerstner waves move each vertex, so the crests come up sharp and the troughs stay flat, and where crests get squeezed together they turn white with foam. Eight finer waves only bend the surface normals, which breaks the reflection of the sun into a glittering path. Finer waves are faded with distance before they would shimmer, and haze swallows the sea toward the horizon.

That image is only a draft for the characters. The whole stage is cut into 6 × 10 cells, and each cell reads the average brightness of the sea under it and picks a character from `. - ~ = + * # % @`, faint to dense, in the colour of that patch of sea. Everything between the characters is transparent, so the page shows through and the waves fill the stage edge to edge. Bright crests, the sun and its path come out as `#` and `@`, troughs as dashes and dots, and the open sky stays almost empty except for the glow around the sun or moon. On a light page the characters are darkened rather than flipped, so the sun is still a dense knot of `@` instead of a hole, the same rule as ASCII Clouds.

Moving over the water casts a ray from the cursor onto the sea, and where it lands a ring ripples outward and fades within a few seconds; a tap does the same, and so does Enter when the sea has keyboard focus. Every wave completes a whole number of cycles in 12 seconds, so the sea loops seamlessly. It runs at 30 frames a second, at full rate only while ripples spread, stops when it scrolls out of view, and draws a single still frame when reduced motion is on or the GPU is emulated in software.
