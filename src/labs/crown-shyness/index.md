---
title: Crown Shyness
summary: A pixel-art forest seen from below, where the treetops stop just short of each other and leave thin seams of sky. Brush the leaves loose, push a crown into its neighbours, shake a tree.
tags: [Canvas, Pixel Art]
date: 2026-11-13
inspiration: https://feralui.dev/pixel-play
order: 14
prompt: |-
  Add a crown-shyness canopy to my project: looking straight up through a forest in pixel art, where neighbouring treetops stop just short of each other and leave thin, ragged seams of sky. Brushing the pointer through the leaves knocks a few loose, dragging a crown pushes it into its neighbours, and a tap shakes a tree. Draw it on the CPU into a small pixel buffer with the canvas 2D API and scale it up by a whole number, with no WebGL and no libraries: one engine file, plus a thin component in my existing framework. The canvas fills its container; don't change my page's styles.

  0. Start from what exists
  - Find where the effect will live, which framework mounts it, and how my site switches between light and dark. Reuse that theme signal; don't add a new one.
  - If I already have small button and icon components, use them for the three controls.

  1. The pixel buffer
  - Pick a whole-number scale so the buffer holds about 36,000 pixels: max(2, round(√(container area in device pixels ÷ 36,000))), with the device pixel ratio capped at 3. The buffer is the container size divided by the scale, rounded up. Size the canvas to buffer × scale, centre it, and let the container clip the extra; use image-rendering: pixelated.
  - Write every pixel into a Uint32Array over one ImageData and put it on the canvas once per frame.

  2. Laying out the forest
  - Lay the forest out on a sheet with the same area as 180 × 240, then scale everything to the buffer, so the crowns look the same size on any shape of container; a wide one just shows more forest.
  - The zenith, where everything converges, sits 45–53% across and 38–46% down.
  - Scatter crown centres by dart throwing (9,000 tries) over the sheet plus a 58 px margin. Spacing r = 0.9 × 180 × (0.33 + 0.2 × min(1, distance from the zenith ÷ (0.55 × the diagonal))), so crowns grow toward the edges; two centres must be (r₁ + r₂) ÷ 2 apart. Even them out with two Lloyd passes on a 3 px grid (distance divided by r), moving each 60% of the way to its centroid. Crown radius R = min(0.74 × the nearest neighbour's distance, 0.9 r).
  - Each crown is a skeleton: 5–7 main branches spread evenly with ±0.25 rad of jitter, 0.5–0.76 R long, each with 1–2 side branches leaving 42–64% of the way out at 0.55–0.95 rad. Its outline is a union of circles: 0.38 R at the centre, 0.36–0.46 R at each main tip, 0.26–0.34 R at each side tip, and 1–2 of 0.16–0.23 R beside every node. 30% of crowns get a more olive ramp.
  - Each crown gets a trunk that runs from its centre away from the zenith: a quadratic curve 1.5 diagonals long, bent slightly, its half-width starting at 0.6 + 0.012 R and growing 0.042–0.054 per pixel of length. Draw the trunks of the crowns farthest from the zenith first.

  3. The shy gap
  - For every pixel, take the signed distance to each circle (distance to its centre minus its radius). s1 is the nearest crown's, s2 the nearest other crown's. Bin the circles into 8 px tiles first, so each pixel only checks a few.
  - Gap margin g = (s2 − s1 − G) ÷ 2 with G = 2.6 px, minus a ragged bite, min(0, 2.1 − 4.6 n), where n is a tiling cloud noise; fade the bite in as the gap opens. Leaves may cover pixels with g ≥ −0.6; the rest is sky. Fill a dark inner mass wherever min(g − 1.6, −s1 − 0.5) > 0.
  - Start with G = 0 and ease it toward 2.6 at a rate of 5 per second, so the crowns pull apart when the forest appears.

  4. Painted leaf clumps
  - Precompute stamps for radius 2 to 12, six variants each: a disc whose rim is a ring of max(5, round(1.2 r + 2 + 0–3)) pointed leaf tips. The rim sits at r × (0.8 + a × tip), with a = 0.14, 0.24 or 0.3 for r ≤ 2, ≤ 4 or larger, and tip = (1 − |2f − 1|)^1.6 × 0.55–1.3 across each tip. Store each pixel's offset, normal, depth from the rim and a little stroke noise.
  - When laying out, fill the ground each crown holds at rest with clumps on a jittered grid of 0.12 R. Big ones go inside, radius (0.085–0.185) R, a little smaller toward the edge, where the margin (computed with a gap of 2.2) is more than 1.2 grid steps. A finer fringe on a grid 0.6× as wide follows the gap, radius (0.06–0.11) R plus 0.6 × the margin. Hang each clump on its nearest branch node. Give each a depth z from 0 (high and sunlit) to 1 (low and in shade): the fringe stays under 0.55, and the inner clumps sit deeper toward the middle of the crown.
  - Draw the clumps with z under 0.52 first, then the main branches over them, then the rest. A clump only paints its own crown's pixels, shrinks to the local margin + 1.1 near the gap, and is skipped under radius 2.
  - Shade on a 12-step ramp, cut sharply like a hand-painted cel: 7.1 − 4.4 z + 1.6 × the sun's glow + 2.5 × (normal · direction to the sun) + 1.3 × stroke, plus 1.5 on the sunlit rim and minus 0.8 on the shaded rim, rounded with Bayer dithering. Before painting, a clump deeper than 0.22 and wider than 2.5 darkens what lies under it by one or two steps, offset away from the sun.
  - Clumps sway on their own: 0.6 sin and 0.4 cos at their own rates, scaled by 0.3 + 0.8 × |wind|.

  5. Sky, sun and time of day
  - The sky is a 6-step ramp from deep blue to near white around the sun, with tiling cumulus drifting across, lit on the side facing the sun.
  - The hour runs from 5.5 to 19. With p = clamp((hour − 12.5) ÷ 6.5, −1, 1), the sun's elevation is 7° + 76° × (1 − p²), and it sits off-centre toward (p, −0.5), cot(elevation) × 1.27 × √(width × height) away, at most half the diagonal: left in the morning, near the middle at noon, right in the evening.
  - Keyframes at 5.5, 7.5, 10, 12.5, 15.5, 17.5 and 19, eased between with smoothstep, give the light colour, the haze colour, three sky colours, the leaves' exposure, and how much haze and how many shafts that hour has. Re-tint every ramp from its base colours when the hour changes.
  - Bark: four ridges across the trunk that crowd together toward the crown, plates and cracks between them, lit by the sun plus a steady skylight so a trunk never goes flat, and moss in patches on the shady side.

  6. Light and haze, at half resolution
  - Measure how much sky each 2 × 2 block shows, weighted toward the sun. For the shafts, march 28 steps toward the sun over 95% of the way, decaying 0.95 per step and stopping at the frame edge. Blur the sky twice with a radius-3 box for a glow that bleeds from every gap. Add haze toward the zenith, 0.02 + 0.3 × depth², plus slowly drifting wisps, and dust motes that only show in bright shafts.
  - Quantise the haze to 16 levels, the shafts to 8 and the glow to 12 with Bayer dithering, so the pixel edges stay hard. Haze strength 0.75, light 0.98.

  7. Motion
  - Step the physics at a fixed 1/120 s. Each crown is a spring to its home (stiffness 7, damping 1.7), pushed by gusts of a light wind (0.1). Neighbouring crowns pushed closer than 98.5% of their rest distance push back, 10 per pixel.
  - Branch nodes are springs too (stiffness 34–62, damping ratio 0.24) that lag behind the crown's acceleration and wave in the wind, at most 0.45 R from rest.
  - Brushing: when the mouse moves over leaves, nodes within 24 px pick up its motion × 2.2 × (1 − d ÷ 24)², and every 16–38 px of travel one leaf comes loose.
  - A tap on a crown kicks its nodes outward at 55–90 px/s and lets 18–24 leaves go over 0.45 s, from the outer clumps inward.
  - Pressing on a crown and moving more than 6 px drags it: it follows the pointer on a stiff spring, softly held within 0.8 R of home (tanh), the neighbours give way, and a leaf falls for every 5 px it travels.
  - A falling leaf is small and soft: a round base, a pointed tip, a darker edge, a midrib and a paler back that shows as it tumbles. It drifts toward the camera in perspective from the zenith, its depth falling at 0.15–0.25 per second and speeding up. Its length is 4.4–6 px ÷ depth, capped at 10, and it fades out between 9.5 and 13, before it gets big. It fades in over 0.25 s; 40% are yellow-green. Keep at most 260.

  8. Controls
  - Three small buttons in the top-right corner. The first cycles the time of day, Morning 7:30, Noon 12:30, Afternoon 15:30 and Dusk 18:30, and the sun eases over in about two seconds. The second shakes every crown on screen at 0.6 strength. The third grows another forest from the next of a few hand-picked seeds, then random ones, with its gaps opening from 0.
  - The light theme opens on the afternoon, the dark theme on dusk. Switch when my theme changes.
  - Touch: a tap shakes, a sideways drag pushes. Use touch-action: pan-y so vertical swipes still scroll the page.
  - Keyboard: make the canvas focusable; Enter or Space shakes every tree. Give it role="img" and a short aria-label, and put a one-line hint at the bottom, worded differently for mouse and touch.

  9. Cost and accessibility
  - Draw at 30 fps normally, and every frame while the pointer has moved in the last 400 ms, a crown is held, leaves are falling, the sun is moving or the gaps are opening. Stop when the canvas is off-screen or the tab is hidden.
  - Under prefers-reduced-motion, draw one still frame with the gaps already open and no wind, ignore the pointer, and disable the shake button.

  10. Done when
  - At a glance it reads as looking up into a canopy: round, painted crowns with thin, ragged seams of sky between them, trunks converging toward the middle, and shafts of light coming through the gaps.
  - Brushing drops a few leaves, a tap showers one tree, a drag pushes the neighbours aside, and every falling leaf stays small.
  - Changing the time moves the sun and recolours the whole scene, both themes look right, and the console is clean.
  - You tell me every file you added or changed.
---
