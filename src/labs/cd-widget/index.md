---
title: CD Player
summary: A music widget where the cover art is the disc. Press play.
tags: [React, CSS]
date: 2025-01-10
inspiration: https://x.com/sovpal/status/1828542375372656894
order: 4
prompt: |-
  Add a music widget to my project where the album cover is the disc: it spins while playing and stops where it is when paused. Use CSS animations only, and build it with my existing framework and design system.

  0. Start from what exists
  - Find my player component, or the card it will live in, with its play and pause state and its icons. Keep its copy and controls.

  1. The disc
  - Crop the cover into a circle the full width of the card and push it up by 40%, so only its lower part shows above the title row.
  - Inside, a spin layer holds the cover and the hub. Draw the hub, the centre hole and its rings, as a single element with one radial gradient and a dashed border, so nothing needs blurring again as it turns.
  - Over the spin layer, add a sheen that doesn't turn: a conic gradient with two soft white streaks and a thin white inner ring. The cover spinning under still light reads as a shiny disc.

  2. Playing
  - Spin it with a CSS animation (rotate 1turn, 8 s, linear, infinite), paused by default. Play sets animation-play-state: running and pause sets it back to paused, so the disc stops at its current angle instead of snapping back.
  - The progress bar is a scaled element on a 40 s linear animation, paused and resumed the same way.
  - Clicking the disc or the play button toggles playing. The button has aria-pressed and an aria-label that says Play or Pause.

  3. The card
  - Tint the card with a blurred copy of the cover behind everything (blur 18px, saturate 1.2, opacity 0.35). It is drawn once and never moves.
  - While held, the disc scales to 0.98 and the play button to 0.88.

  4. Motion and accessibility
  - Under prefers-reduced-motion, make transitions and animations instant.
  - The cover images are decorative; the title and artist are real text.

  5. Done when
  - Pausing freezes the disc and the bar exactly where they are, and playing resumes from there.
  - Only transform and scale animate while it plays.
  - It works with mouse, touch and keyboard, in light and dark themes.
  - You tell me every file you added or changed.
---
