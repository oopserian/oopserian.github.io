---
title: Paper Attachments
summary: Pick up a file and it becomes a sheet of paper that bends, leans into the motion and casts a soft shadow. Drop it into the chat to attach it, then send it flying into the conversation.
tags: [WebGL2, Physics, Pointer Events]
date: 2026-11-16
order: 15
prompt: |-
  Add a tactile attachment interaction to my project: a few files lie on a desk beside a chat. Picking one up turns it into a real sheet of paper that sags under its own weight, leans into the motion and casts a soft shadow that spreads as it rises. Drop it on the message field to attach it; sending flies the pages into the conversation. Draw the paper with raw WebGL2 and a small cloth simulation on the CPU, with no three.js and no physics library: one engine file for the paper, one for the desk and the flow, and a thin component in my existing framework. Everything at rest is ordinary DOM; the canvas only draws while a sheet is in the air.

  0. Start from what exists
  - Find my chat or message components, my button and icon components, and my design tokens for colour, radius, shadow and easing, and how my site switches between light and dark. Reuse them; don't add a second theme signal.
  - If I already have WebGL helpers (compile a program, a fullscreen quad, an offscreen target, a canvas texture), use them.

  1. One stage, three arrangements
  - Lay everything out in design pixels inside one inner box and scale that box with a CSS transform to fit the container, keeping 30 px at the bottom for a hint line. A canvas covers the same box at the same scale, with a pixel ratio of scale × min(2, devicePixelRatio).
  - Wide (width ≥ 560 and width ÷ height ≥ 1.15): files on the left, the chat on the right, the pair centred in at most 840 px; scale clamp(min(w ÷ 720, h ÷ 400), 0.9, 1.45). Tall (height ≥ 410): the chat on top, the files in a row underneath; scale clamp(min(w ÷ 400, h ÷ 540), 0.82, 1.25). Anything smaller is compact: the files in a narrow column on the left; scale clamp(min(w ÷ 390, h ÷ 250), 0.72, 1.1).
  - Thumbnails are 58, 84 or clamp(0.3 × height, 86, 124) px tall (compact, tall, wide). A sheet in the hand is 104, 132 or clamp(0.36 × height, 120, 146) px wide, the photo 4% wider. Attachment tiles are 44 px tall in compact and 56 px otherwise.

  2. The pages
  - Paint each page once with the canvas 2D API at 768 px wide, after my display font has loaded (wait at most 3 s): a proposal with a serif title and a line drawing, a photo, a budget table. Use the same canvas as the DOM thumbnail (a JPEG data URL) and as the WebGL texture, so swapping one for the other has no seam.
  - Paper stays paper in both themes: off-white, square corners, a two-layer drop shadow (0 0.5px 0.6px and 0 1.5px 2.5px). In dark mode dim it to 90%. The two documents have a folded corner.

  3. The sheet
  - A grid 13 points across and max(8, round(13 × height ÷ width)) down. Verlet integration at a fixed 1/120 s, at most 6 steps per frame, frame time capped at 1/30 s.
  - Distance constraints, 10 iterations: neighbours and diagonals at full strength, every 2nd point at 0.9, every 4th at 0.7, every 8th at 0.35. Photo paper is stiffer: add 0.1, 0.3 and 0.5 to those and an extra every-12th at 0.6. After the constraints, find the flat sheet that best fits the current shape (shape matching) and pull every point 3.5% of the way to it (7% for the photo), so bends stay wide and smooth instead of folding along one row. The desk is a floor at z = 0 with friction.
  - The hand holds a disc of radius 17% of the sheet's width around the point you pressed. Pin those points to the hand, turned by its pitch, roll and yaw.
  - When the sheet grows or shrinks, scale every point about the hand; never change the rest lengths, which squeezes the paper and crumples it.
  - Scale the forces with the sheet, so a small one flies like a big one seen from far away: gravity 520 × scale while held and 900 × scale otherwise, air drag across the face 6 × min(1, 1.4 × scale), damping 1.6 on velocity relative to the hand plus 0.3 × scale overall. Each step the hand carries every point 70% of its own motion, so a quick flick swings the paper but never piles it back into the hand.

  4. The hand
  - Every hand value is a spring with a response time and a bounce. Position follows the pointer at 0.07 s while held, and at 0.46 s with 0.05 bounce on the way down; height rises to 62 px at 0.34 s with 0.16 bounce; size at 0.4 s with 0.1 bounce.
  - Lean into the motion from the smoothed velocity: roll clamp(vx × 0.0003, ±0.16), pitch clamp(−vy × 0.0003, ±0.16), and when you grip it off-centre, yaw clamp((offset y × vx − offset x × vy) × 0.000003, ±0.22). Lean 40% as much and drop the yaw on the way down.
  - Keep the held sheet on stage: clamp the hand so the sheet, as projected on screen, stays 8 px inside every edge. A lifted sheet looks CAMZ ÷ (CAMZ − height) times bigger and is pushed outward from the centre, so clamp in screen space. Apply it the moment you press, before the pointer moves.
  - Over the message field (its box plus 18 px at the sides and bottom and 26 px above), shrink the sheet to 62%, give the field an accent ring, and roll the placeholder from "Message" to "Drop to attach", letter by letter.

  5. Drawing it
  - A perspective camera at z = 1100 with the field of view chosen so z = 0 lands exactly on the page underneath. Clear depth before each sheet, so the one lifted last is always on top and two sheets never pass through each other.
  - Lying flat, a sheet must match its texture exactly. Lighting: 0.72 + 0.28 × clamp(N · L ÷ L.z, 0, 1.25), with the light high and to the upper left. Add a Blinn-Phong highlight minus the highlight a flat sheet would get, gloss 0.06 for documents and 0.3 for the photo, capped at 0.3. The back is a paper-back colour with 6% of the print showing through. Sample the texture with a −0.5 LOD bias and anisotropic filtering, so it stays as sharp as the DOM thumbnail.
  - The folded corner: cut a 20% corner out in the shader and draw the flap as one triangle that turns about the crease. It opens as the sheet lifts and folds back once the sheet is under 14 px on its way home, with a faint shadow under the fold.
  - Shadows: draw every sheet flattened into an offscreen target, max blended. Red is the key shadow, shifted 0.16 px right and 0.55 px down per px of height and fading from 1 to 0.6 by 140 px. Green is a contact shadow nudged 0.7 px down. Blur it with 13 taps across and then down, both radii growing with height. Lay it on the desk at 0.46 key and 0.3 contact in light, 0.62 and 0.55 in dark, the key fading in over the first 24 px of lift.

  6. The flow
  - Pressing a thumbnail lifts its sheet in the same frame the thumbnail hides, leaving a faint dent. Release over the field and the sheet glides to where its tile will sit and settles flat; release anywhere else and it goes back to its slot.
  - A click or tap that moves less than 5 px sends the file along a curve to the field on its own (520 ms, ease-in-out cubic); clicking an attached file brings it back.
  - The attachment row opens to tile height + 10 px over 450 ms on my standard easing curve. A tile is a small paper thumbnail with a × badge, shown on hover and focus, and always on touch screens. Drag a tile away to remove it.
  - Hand a sheet back to the DOM only when the hand has arrived and the paper has stopped: every point under 0.35 px high and moving less than 0.02 px per step. Then swap it for the tile or thumbnail in the same frame.
  - Send: the messages slide up and the attachment row closes together on the same curve over 450 ms, so the chat only moves one way. Each tile lifts 30 px and flies in a 520 ms arc, 120 ms apart, into an outgoing group of page thumbnails. "Delivered" rolls in under them, the originals fade back onto the desk, typing dots appear after 1.1 s, and the reply comes 1.5 s later and depends on what has been sent so far.
  - When a message fades out of view at the top of the chat with less than 34 px still showing, hide all of it rather than leaving a grey sliver.

  7. Input, accessibility and cost
  - Pointer events with pointer capture, and touch-action: none on files and tiles so dragging doesn't scroll the page.
  - Keyboard: each file is a toggle button with aria-pressed; Enter or Space attaches it or brings it back. Delete or Backspace on a tile removes it and moves focus to its neighbour. After sending from the keyboard, move focus to the first file sent. The chat thread is aria-live="polite".
  - Animate only while a sheet is in the air, and stop requestAnimationFrame when none is left.
  - Under prefers-reduced-motion, springs don't overshoot, the paper doesn't lean, and layout shifts happen at once.
  - Without WebGL2, use flat image cards that follow the same paths, stay on stage and shrink over the field.
  - Put a one-line hint at the bottom, worded for mouse ("click to attach") and for touch ("tap to attach").

  8. Done when
  - A sheet you pick up sags, leans when you move it, swings a little when you stop, and its shadow spreads and softens as it rises. It never crumples, even when small and flying.
  - Picking up, dropping and landing have no visible swap between the DOM thumbnail and the paper.
  - Mouse, touch and keyboard can all attach, remove and send, in both themes and in all three arrangements, with nothing leaving the stage and a clean console.
  - You tell me every file you added or changed.
---
