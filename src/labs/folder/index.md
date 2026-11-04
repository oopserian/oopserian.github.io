---
title: Folder
summary: A folder that opens and fans out the photos inside. Hover or tap it, then pick a photo.
tags: [React, CSS, SVG]
date: 2025-01-08
order: 5
prompt: |-
  Add a folder to my project that opens and fans out the photos inside when you point at it. Use SVG and CSS transforms, and build it with my existing framework and design system.

  0. Start from what exists
  - Find where the folder goes, the photos or files it should show, and my accent colour, radius, shadow and spring-easing tokens. Use them.

  1. Shapes and colours
  - Draw the back of the folder, tab included, as one SVG path (viewBox 332×256, about 148 px wide), so the tab scales with the folder.
  - The front is a plain element covering the bottom 80%, with a slight vertical gradient, a faint white top edge and a small icon at 40% opacity.
  - Mix every folder colour from my accent with color-mix() in oklab: with white in light mode and with black in dark mode (through light-dark()), so it suits either theme.

  2. Opening
  - Three photos sit behind the front, between it and the back.
  - Open: the front tips back on its bottom edge, perspective(800px) rotateX(-32°), and its shadow deepens. The photos rise and fan out: the left and right ones go up 30% and 18 px outward, turned -9° and 9°; the middle one goes up 44%.
  - Stagger them: the middle photo first, the left one 50 ms later, the right one 100 ms later, on a 0.45 s spring that overshoots slightly. The front takes 0.5 s.
  - Pointing at a photo lifts it a further 20%, straightens it and scales it to 1.15. It stays behind the front, so it still looks like it is inside the folder.

  3. Input and accessibility
  - Mouse: hovering opens it and leaving closes it.
  - Touch: a tap opens or closes it. While it is open, tapping a photo picks that photo instead of closing the folder.
  - Keyboard: the folder is a focusable button with aria-expanded, and Enter or Space toggles it.

  4. Done when
  - Opening and closing look the same with mouse, touch and keyboard.
  - No photo ever comes out in front of the front panel.
  - The colours look right in light and dark themes, and under reduced motion the changes are instant.
  - You tell me every file you added or changed.
---
