---
title: Card Piles
summary: Drag cards from pile to pile, or onto empty space to start a new one. Click a pile to fan it out.
tags: [React, Pointer Events, CSS]
date: 2026-10-27
order: 8
prompt: |-
  Add card piles to my project: cards you can drag from pile to pile, or onto empty space to start a new pile, and piles that fan out when clicked. Use pointer events and CSS transitions, no drag-and-drop library, and build it with my existing framework and design system.

  0. Start from what exists
  - Find what the cards stand for in my product (files, tags, items) and where the piles live. Use my card component and my accent, radius, shadow and spring-easing tokens.

  1. Placing cards
  - Position every card absolutely at the top left of the stage and move it only with the translate property, from a computed --x and --y.
  - Keep each pile's position as a fraction of the stage's width and height, so it survives resizes, and clamp it so the cards stay inside the stage.
  - In a pile, each card lower down sits 3 px lower and is tilted a few degrees; the top card is straight. When a pile has two or more cards, a badge on the top card shows the count.

  2. Dragging
  - Only the top card of a pile, or any card of a fanned-out pile, can be dragged. Use setPointerCapture.
  - Ignore movement under 4 px, so a click isn't taken for a drag.
  - While dragging, write the offset into --dx and --dy on the element, with the translate transition off, so the card sticks to the pointer. The card straightens, scales to 1.08 and gets a stronger shadow.
  - The nearest other pile whose centre is within 56 px of the card's centre is the drop target. Show a dashed ring under it.
  - On release, work out where the card belongs: on top of the target pile (which then moves to the top layer), back on its own pile, or on empty space as a new pile. Clear --dx and --dy in the same frame, so the transition carries the card from where it was dropped to its new place on a slightly springy curve.
  - On pointercancel, put the card back where it came from.

  3. Fanning out
  - Clicking a pile of two or more fans it out in an arc in front of everything and dims the other piles. Clicking it again, or the empty stage, folds it back.
  - Space the cards up to 90% of a card's width apart, closer if the stage is narrow, and move the pile in from the edge if the fan would not fit.
  - A Reset button puts everything back. It is disabled until something has changed.

  4. Input and accessibility
  - A card is a button in the tab order only when it can be dragged. Enter and Space fan out its pile. Its label says how many cards the pile holds.
  - Use touch-action: none on the cards, so dragging doesn't scroll the page.
  - Ignore the click that follows a mouse drag, so a drop doesn't also fan out a pile.

  5. Done when
  - Cards never jump: they slide from where they were dropped.
  - Piles keep their places when the window is resized.
  - It works with mouse, touch and keyboard, in light and dark themes.
  - You tell me every file you added or changed.
---
