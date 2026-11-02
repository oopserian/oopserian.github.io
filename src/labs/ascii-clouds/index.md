---
title: ASCII Clouds
summary: Summer clouds and a dusk sky drawn in ASCII characters. Sweep through them and the characters scatter, then drift back.
tags: [Canvas, Pointer Events]
date: 2026-11-02
order: 9
---

The screen is one canvas cut into 8-pixel cells, and every cell shows one character from `. : - = + * # % @`, faint to dense. Each frame the engine works out a colour per cell, writes it into a tiny offscreen image one pixel per cell and scales that up without smoothing. The characters are drawn once, white, into a small strip; a second layer keeps the character each cell shows and only redraws the cells whose character changed, and the colour image is cut down to those shapes. Under the clouds sits a sky that is painted once per scene and never moves, so most of the screen is a quiet field of dots.

The clouds are piles of circles. A cumulus is five domes, tallest in the middle, overlapping just enough to leave a notch between each pair, with a row of flat puffs underneath and the bottom cut straight. Every cell takes its shade from the deepest circle it sits in, from which way that circle faces and how high it is in the cloud, and the result snaps to five flat tones, the way clouds are painted in hand-drawn animation. The brighter the tone, the denser the character: lit tops are `@` and `%`, shadows fall back to `*` and `+`. The character is picked by tone rather than by contrast with the background, so on a white page the clouds turn into blue ink instead of holes. Dusk uses long banks lit from below: gold along the bottom edge, pink and purple above, a sun drawn in `@` and a broken reflection of `-` and `=` on the sea.

Sweeping the cursor pushes nearby characters away along the stroke, and a click or a tap bursts them outward. A spring pulls each one back to its place within a second or two, while only the edges of the clouds keep puffing gently. Everything loops on a 12-second cycle. The canvas runs at 30 frames a second, stops when it scrolls out of view, and draws a single still frame when reduced motion is on. Drop an image on the screen to turn it into characters instead.
