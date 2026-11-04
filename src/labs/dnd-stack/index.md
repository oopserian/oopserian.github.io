---
title: Card Piles
summary: Drag cards from pile to pile, or onto empty space to start a new one. Click a pile to fan it out.
tags: [React, Pointer Events, CSS]
date: 2026-10-27
order: 8
prompt: >-
  Build React card piles you can drag cards between. Position every card absolutely and move it with the
  translate property. While dragging, write the offset into two CSS variables with the transition off, so the
  card sticks to the pointer; on release, work out where the card belongs, clear the offset in the same frame,
  and let the transition carry it there from where it was dropped. Light up the nearest pile within 56px of the
  card's centre as the drop target; dropping on empty space starts a new pile. Keep pile positions as fractions
  of the stage so they survive resizes. Clicking a pile fans it out in front and dims the rest.
---
