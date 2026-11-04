---
title: Progressive Blur
summary: A blur that builds up from a sharp centre to a heavy rim. Click the photo.
tags: [React, CSS]
date: 2025-02-28
order: 1
prompt: |-
  Add a progressive blur to a photo in my project: sharp in the centre, heavier toward the rim, switched on and off by clicking the photo. Use only CSS (backdrop-filter and masks), no canvas, and build it with my existing framework and design system.

  0. Start from what exists
  - Find the image component this goes on, and my design system's radius, shadow and easing tokens. Use them; don't add new ones.
  - If I already have a blur or frosted-glass utility, check whether it can take a mask per layer before writing a new one.

  1. The blur
  - Lay six overlay layers over the photo, each at inset: 0, inside a wrapper with overflow: hidden and the photo's radius.
  - Layer n (1 to 6) uses backdrop-filter: blur(2^n px), so 2, 4, 8, 16, 32 and 64 px. Add -webkit-backdrop-filter for Safari.
  - Mask each layer with radial-gradient(circle, transparent A, black A + 12%). A starts at 20% and grows by 12% per layer, so each layer leaves a larger clear centre than the one before. The blur builds up toward the rim and the centre stays sharp.

  2. Switching it
  - The photo is a button with aria-pressed and an aria-label. A click toggles the blur.
  - Stacked backdrop filters are expensive, because each layer blurs everything under it again. Keep the layers out of the DOM while the blur is off.
  - On: mount the layers at opacity 0, then set them to 1 on the next frame, so they fade in over 0.5 s with my standard ease-out.
  - Off: fade them out the same way, and unmount them when the last layer's transitionend fires.
  - While the photo is pressed, scale it to 0.98.

  3. Motion and accessibility
  - Under prefers-reduced-motion, make the fade instant.
  - Keep the photo's alt text. The layers are decorative.

  4. Done when
  - The centre stays sharp, the rim is heavily blurred, and no ring shows where one layer ends.
  - With the blur off, no backdrop-filter element is left in the DOM.
  - It works with mouse, touch and keyboard (Enter and Space), in light and dark themes.
  - You tell me every file you added or changed.
---
