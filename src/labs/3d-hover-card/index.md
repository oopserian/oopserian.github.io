---
title: Hand of Cards
summary: Four cards fanned out in a hand. Pick one up and it tilts toward your pointer.
tags: [React, CSS]
date: 2025-01-10
order: 2
---

Each card is rotated around a point far below the hand, 8° per step from the middle, so the fan falls into an arc by itself. Picking one up raises it, turns it upright and nudges its neighbours aside, all with CSS transitions on a slightly springy curve.

The pointer's position on the card goes straight into two CSS variables, without a React render. CSS turns them into `rotateX` and `rotateY` under a 600px perspective, and slides a soft highlight across the card the same way. The card that moves sits inside a wrapper that stays put, so lifting it never slips it out from under the pointer.
