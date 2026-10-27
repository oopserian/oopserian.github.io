---
title: Card Piles
summary: Drag cards from pile to pile, or onto empty space to start a new one. Click a pile to fan it out.
tags: [React, Pointer Events, CSS]
date: 2026-10-27
order: 8
---

Every card is absolutely positioned and moved with the `translate` property. While you drag, the offset goes straight into two CSS variables and the transition is off, so the card sticks to the pointer. On release React works out where the card belongs, the offset is cleared in the same frame, and the transition carries it there from wherever you let go.

The nearest pile within 56px of the card's centre lights up as the drop target. Piles keep their position as a fraction of the stage, so they stay in place when it resizes. A fanned-out pile comes to the front and dims the rest, and any of its cards can be dragged.
