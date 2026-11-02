---
title: Dot Matrix
summary: Summer clouds and a dusk sky on a screen of small dots. Sweep through them and the clouds scatter, then drift back.
tags: [Canvas, Pointer Events]
date: 2026-11-02
order: 9
---

The screen is one canvas, and every dot is one pixel of a tiny offscreen image. Each frame the engine works out a colour per dot, writes it into that image, scales it up without smoothing and cuts it into round dots with a mask drawn once. Under the clouds sits a sky layer that is painted once per scene and never moves.

The clouds are piles of circles. A cumulus is five domes, tallest in the middle, overlapping just enough to leave a notch between each pair, with a row of flat puffs underneath and the bottom cut straight. Every dot takes its shade from the deepest circle it sits in, from which way that circle faces and how high it is in the cloud, and the result snaps to five flat tones, the way clouds are painted in hand-drawn animation. Dusk uses long banks lit from below: gold along the bottom edge, pink and purple above, and a broken gold reflection on the sea.

Sweeping the cursor pushes nearby dots away along the stroke, and a click or a tap bursts them outward. A spring pulls each dot back to its place within a second or two, while only the edges of the clouds keep puffing gently. Everything loops on a 12-second cycle. The canvas runs at 30 frames a second, stops when it scrolls out of view, and draws a single still frame when reduced motion is on. Drop an image on the screen to light the dots from that instead.
