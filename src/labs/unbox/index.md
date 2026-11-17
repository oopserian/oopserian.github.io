---
title: Unboxing
summary: Tear the seal off a gift box, lift the lid, rip open the foil pack inside and look through five star-chart cards, the last one holographic. Every drag stays under your finger.
tags: [Three.js, WebGL]
date: 2026-11-17
order: 15
prompt: |-
  Add a continuous 3D unboxing to my project: a gift box on a desk. You tear off the seal, lift the lid, take the card pack out of its tray, rip the pack open along the top, push the cards out, look through them one by one (the last one is holographic), and finally lay all five out and pick one up to turn it over. It is one scene with no cuts, and every drag stays under the finger: the exact point you grabbed stays under the pointer the whole way. Build it with three.js (PBR materials, an environment map, soft shadows and raycasting are what it's for) and paint every texture on a canvas at start, with no image files. Use one file of texture painters, one engine file, and a thin component in my existing framework that only holds the canvas, a one-line hint and a "New box" button.

  0. Start from what exists
  - Find where the piece will live, which framework mounts it, my button and icon components, my design tokens for colour, radius and easing, and how my site switches between light and dark. Reuse them; read the theme from the stage's computed color-scheme and follow changes to it.
  - The canvas is transparent: the desk is the stage's own background colour, so light and dark match the page exactly. Only the box, the pack, the cards and their shadows are drawn.
  - Fonts: a serif for titles, a sans for small caps labels and a mono for numbers. Use the ones my site already ships, add any that are missing to my repo, and wait for them (at most 3 s) before painting, because canvas text won't wait.

  1. Scene and light
  - Units are centimetres; the desk is the plane y = 0. Renderer: antialias, alpha, sRGB output, Neutral tone mapping, VSM shadows. Environment: RoomEnvironment through PMREM at intensity 0.62.
  - Key light 0xfff6ec at 2.1 from (−26, 58, 30), casting shadows into a 2048² map covering ±30 cm, radius 9 with 20 blur samples, bias −0.0004, normal bias 0.03. A cool fill 0xe8eeff at 0.35 from (40, 20, 10). A third white light that follows the camera from its upper left and only turns on (0.9) once the pack is in your hands, for glints on the foil.
  - The desk is a 400 cm plane with ShadowMaterial (0x2a2018 at 0.22). In dark mode: shadow black at 0.5, environment 0.42, key 1.75, fill 0.22, exposure 0.92.
  - Camera: 28° vertical field of view. It has two poses, each a target, an elevation, an azimuth and the width and height that must fit in frame; the distance comes from whichever of the two is tighter at the current aspect, so nothing is ever cropped. A looks at the box from the front right at 50°; B rises above 40 cm and looks almost level at whatever is in your hands. Blend between them with a spring.

  2. The box
  - 13.4 cm wide, 17.4 deep, 4.6 high, board 0.22 thick. Every panel is a real box with thickness. UVs are in world centimetres so paper grain never stretches; the lid top, lid inside, front and right side carry full printed artwork.
  - Fog-blue board (#bfc9d6) outside and navy (#0f1934) inside, both with a paper grain normal map. The lid top has a debossed star-trail mark and the name "Night Atlas" in foil; the inside of the lid is a printed winter star chart, and the base carries small printed labels ("Nº 01", "SERIES 01 · FIVE CARDS").
  - The lid is hinged on the back edge, opens to 112° and rests at 104°. A 2.4 cm skirt hangs from its front edge, and a 0.9 cm cobalt tear strip (#2448d8) runs across the middle of the skirt. Once the strip is gone, the top half of the skirt goes with the lid and the bottom half stays on the box.
  - Inside is a navy tray with a recess for the pack (pack size + 0.26 cm) and a 1.05 cm half-round thumb notch on one side. The pack lies in it face up.

  3. Paper strips
  - The tear strip and the strip across the top of the pack use the same class: two rows of points joined by distance constraints along each edge, across, on the diagonals (stiffness 0.6) and skipping one point (bending stiffness 0.35–0.4). It can bend across its width and twist, but it can never fold in its own plane. Verlet integration, 2 substeps, 14 iterations, damping 0.975.
  - The strip lies along a path on the object's surface. Everything before the peel point p moves freely; everything after is pinned to the path every frame. Hold the free end and pull: when the straight distance from the hand to the peel point is longer than what is already peeled, peel further (at most 70–80 cm a second). The peel point also follows the hand's position along the strip, so tearing sideways feels direct.
  - Near the hand the strip is pulled toward an ideal shape: leave the surface, curl around a radius of 0.14–0.16 cm, then run straight to the hand. Let gravity take over as the strip gets slack. Keep the points out of the box and the pack, and above the desk.
  - Build the mesh so the printed side faces out. The tear strip starts with a raised 1.05 cm tab printed "PULL", then "TEAR TO OPEN →".

  4. The pack
  - 7.4 × 12 cm, made of two 38 × 46 meshes, front and back. They are flat at the edges and puff out 0.27 cm in the middle, with a 1 cm crimp at the bottom. The top row of both meshes is the jagged tear line, so the mesh columns line up one to one with the strip's points.
  - Material: metallic foil with crumple normals, a printed navy and silver design, a silver inner layer seen through the opening, and a holographic layer (step 5).
  - Once torn, the mouth opens outward wherever it is torn, and the cards' top edges show inside.

  5. The cards
  - 6.3 × 8.8 cm, 0.32 cm corner radius, 0.028 cm thick: a front face, a back face and a thin edge strip. Paint at 160 px per cm: colour, a second map with R = holo mask, G = roughness, B = metalness, and a normal map from a height map.
  - The design is a star-chart field guide. Commons: cotton paper (#ece7db) with fibres and specks, a thin frame, "Nº 01" and "NIGHT ATLAS" across the top, a navy eyepiece view 1.93 cm in radius debossed into the card, and a cobalt foil degree ring around it (a tick every 5°, a long one every 30°). Below: a small caps kicker in cobalt, the title in the serif, two lines of description, and three columns of data separated by hairlines. Rarity stars and "01 / 05" sit along the bottom.
  - The five: Waxing Gibbous (the moon), Long-Period Comet, Ringed Giant, Lyra, and Totality, a total solar eclipse that is the rare. The rare is on black soft-touch stock with every line, the corona and all text in silver holo foil.
  - Draw the moon and the ringed planet as a 45° cosine halftone screen, computed per pixel with antialiasing so the lit edge is a clean circle. Warp the moon's maria with noise before thresholding them, so they are irregular but crisp. Draw the comet's tail and the corona with fine engraved strokes, and Lyra as a small chart.
  - Commons barely shine: clearcoat 0.05 at roughness 0.55 and a faint sheen. The rare gets clearcoat 0.12. Card faces don't receive shadows, so the raised rare card never leaves a grey patch on its neighbours.
  - Holo layer, added after lighting with onBeforeCompile: the colour comes from the reflection direction, so tilting shifts it. The brightness lives in a reflective band that slides across the surface with the view angle, a very faint base outside the band, plus a few sparkles. The rare uses a narrow band set diagonally, so tilting sweeps it from corner to corner, and it sweeps once more on its own when it comes up.
  - Painting a card face takes 200–600 ms. Start each card with 1-pixel placeholder textures and paint the real ones one at a time in idle callbacks, uploading each to the GPU (initTexture) as it's done. Swapping one texture for another doesn't recompile the shader. If someone tears the pack before painting finishes, paint the rest on the spot.

  6. The seven steps
  - Seal: grab within 30 px (scaled with the stage) of the tear strip's free end. The hand moves on a vertical plane just in front of the box. Pull right to tear; at the end, let go and the strip is flung off screen. While nobody touches it, the tab lifts every 4.2 s; after a few lifts with nobody around it waits for the pointer to come back. Trying to lift the lid first raises it only 2°, and the tab and the hint both nudge.
  - Lid: grab it anywhere. On each move, search every angle from 0 to the limit in 1° steps, then in 0.1° steps around the best one, for the angle that puts the grabbed point closest to the pointer on screen. Changing the angle costs almost nothing, so the point stays pinned under your finger. Release past 42°, or flicking up, or a tap opens it; otherwise it closes with a small bounce. As it opens, the camera backs up and rises so the standing lid stays in frame.
  - Pack: grab it and lift. The hand moves on a vertical plane facing the camera. Height turns the pack from lying in the tray to facing you (fully by 9 cm). It can't slide sideways while still in the recess (free by 2.2 cm), and its corners never go below the tray. Release above a quarter of the way, or tap, and it flies to your hands while the camera rises to pose B and the box drops out of frame below; otherwise it falls back.
  - Tear: grab the top of the pack and pull sideways. Every bit you tear makes the pack sway, with a 4 ms vibration on touch devices. At the end the strip drops away, the mouth opens and the pack leans toward you.
  - Slide: drag along the pack's up direction and the cards follow. Past 3.4 cm, or a tap, the stack pops out into your hands and the empty pack falls away behind.
  - Look through: the camera moves in on a stack of large cards, each one offset a little with a slightly different angle, like a real stack. Grab the top card and it follows the finger and leans the way it's going. Swipe it more than 2 cm, flick it faster than 22 cm/s, or tap it, and it slides out to that side and around the back of the stack. The edge facing the stack lifts toward you on the way out and away from you behind, so it never cuts through. The whole stack tilts gently with the pointer, except while you're holding a card. The hint counts 1/5, 2/5…. When only the rare is left, it moves forward on its own, scales to 1.03 and the holo sweeps once.
  - Spread: swipe the rare and all five spread out. If the stage is wider than 1.45:1, they go in one row 7.3 cm apart on a shallow arc, with the rare in the middle, a little forward and 1.05× larger. Between 0.66:1 and 1.45:1, they go in two rows, three on top with the rare in the middle and two below. Narrower than 0.66:1, the rare sits alone on top with the others in pairs. Re-lay them out when the stage resizes.
  - Hover and inspect: judge hover against where each card should be, not its lifted mesh, and give the hovered card a 3 mm margin, so the pointer resting on an edge never flickers. A hovered card rises on springs, scales to 1.025 and tilts toward the pointer, then sinks back slowly. Click one to bring it up to fill 70% of the height while the others step back. Then drag anywhere to turn it: half the stage's width is most of a turn, vertical drags tip it at most 0.6 rad. On release it carries its momentum and settles on the front or the back. Click it or empty space to put it back.
  - Use springs (response and bounce) for everything that settles, and a scene clock for timed steps so they still work when frames drop.

  7. Hints, keyboard and touch
  - One line at the bottom: a small round badge with the step (1 to 5, then 2/5 while you look through, then ✓) and what to do: "Pull the tab to tear it open", "Lift the lid", "Lift the pack out", "Tear along the top", "Slide the cards out", "Swipe for the next card", "Swipe to lay them out", "Click a card to look closer" (tap on touch), "Drag to turn it". Fade each change in over 320 ms. Show "New box" at the top right once the seal is torn; on a small stage, show it as an icon only.
  - Keyboard: the stage is focusable. Enter or Space takes the next step by driving an invisible hand through the same press, drag and release a finger would make. Each drag runs in one direction until the scene says the step happened, so it finishes whatever the stage size or frame rate, and any real pointer stops it. A press that arrives while the previous step is still letting go is queued, not dropped. Once the cards are spread, Enter and the arrows cycle through them up close and Escape puts one back; while looking through, the arrows swipe. R starts over.
  - Touch: give the canvas touch-action: pan-y and stop touchmove only while something is held, so a swipe on empty desk still scrolls the page.

  8. Cost and fallback
  - Draw every frame while something is held, something is scheduled, or for 1.5 s after any input; otherwise cap at 30 frames a second. Each frame, sum the world matrices of visible objects, the camera, the strip points, the holo sweep and the lid angle. When that changes by less than 5 × 10⁻⁴ for 16 frames, stop and wait for the next pointer, key, resize or tab nudge. When you wake, advance the scene clock by the time you slept. Let the floating pack settle after 6 s without input so the loop can sleep there too. The holo drift only advances on frames you draw, so it never jumps after a sleep.
  - Stop entirely when the stage is off screen or the tab is hidden. Device pixel ratio at most 2.
  - Under prefers-reduced-motion: springs don't overshoot, the pack doesn't float, and the tab and hint don't nudge.
  - Without WebGL or on a software renderer (SwiftShader, llvmpipe), show a pre-rendered still of the five cards spread out on a transparent background: a row for wide stages and two rows for narrow ones, one for light and one for dark, placed with object-fit: contain.
  - On unmount, remove every listener and observer and dispose of every geometry, material, texture and the renderer.

  9. Done when
  - The whole sequence runs from sealed box to a card turning in your hand with no cuts. The grabbed point never drifts from the pointer, whether it's the tab, the lid, the pack, the strip or a card.
  - The strips curl and hang like paper, the foil and the rare card catch the light as they tilt, and the halftone moon and planet are crisp up close.
  - Mouse, touch and keyboard all work on a small card and on a full page, swipes on empty desk still scroll the page, the console is clean, and nothing is drawn while nothing moves.
  - You tell me every file you added or changed.
---
