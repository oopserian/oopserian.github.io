---
title: Hand of Cards
summary: Four cards fanned out in a hand. Pick one up and it tilts toward your pointer.
tags: [React, CSS]
date: 2025-01-10
order: 2
prompt: >-
  Build a React component: four cards fanned out like a hand. Rotate each card around a pivot far below the
  hand, 8° per step from the middle, so the fan falls into an arc. Hovering a card lifts it, turns it upright
  and nudges its neighbours aside, with CSS transitions on a slightly springy curve. Write the pointer position
  on the card into two CSS variables without a React render, and turn them into rotateX and rotateY under a
  600px perspective, with a soft highlight sliding across the card. Keep the hover target in a wrapper that
  stays put, so lifting a card never slips it out from under the pointer.
---
