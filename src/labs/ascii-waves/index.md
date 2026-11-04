---
title: ASCII Waves
summary: Ocean waves drawn entirely in ASCII characters, from a sea rendered live with Three.js that you never see. Move across the water and rings ripple out.
tags: [WebGL, Three.js, Shaders]
date: 2026-11-04
order: 10
---

Underneath the characters is a real 3D sea, set up with Three.js and drawn by hand-written shaders into an offscreen image that never reaches the screen. The camera hangs 11 metres up and looks steeply down, so the whole frame is water and there is no sky. A grid runs from just under the camera into the distance, dense nearby and sparse far away. Ten Gerstner waves move each vertex, so the crests come up sharp and the troughs stay flat, and where crests get squeezed together they turn white with foam. Eight finer waves only bend the surface normals, which breaks the light into glints. That image keeps two things for each pixel: how bright the sea is there, with crests above troughs and lit faces, glints and foam brighter still, and which way the crest runs across the screen.

The stage is cut into 8 × 8 pixel cells and every cell gets a character, none left blank. The brightness under the cell picks it from `- ~ = * # @`: troughs come out as dashes and tildes, slopes as `=`, crests as `#` and foam as `@`. Its colour slides along a ramp from deep blue to white, or on a light page from pale grey-blue to navy, so denser always means stronger ink, the same rule as ASCII Clouds. Then each character turns to lie along the crest it sits on, so the rows of characters trace the swell. The crest direction is averaged over a few cells, and flat patches where it can't be told stay level. Everything between the characters is transparent, so the page shows through and the waves fill the stage edge to edge.

Moving over the water casts a ray from the cursor onto the sea, and where it lands a ring ripples outward, its crest white with foam and the characters turning around it, then fades within a few seconds; a tap does the same, and so does Enter when the sea has keyboard focus. Every wave completes a whole number of cycles in 12 seconds, so the sea loops seamlessly. It runs at 30 frames a second, at full rate only while ripples spread, stops when it scrolls out of view, and draws a single still frame when reduced motion is on or the GPU is emulated in software.
