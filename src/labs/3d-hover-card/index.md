---
title: Hand of Cards
summary: Four cards fanned out in a hand. Pick one up and it tilts toward your pointer.
tags: [React, CSS]
date: 2025-01-10
order: 2
prompt: |-
  Add a hand of cards to my project: a few cards fanned out in an arc; pointing at one lifts it and tilts it toward the pointer in 3D. Use CSS transforms only, no 3D library, and build it with my existing framework and design system.

  0. Start from what exists
  - Find where the hand goes, the card images or components it shows, and my design system's shadow, radius and spring-easing tokens. Use them.

  1. The fan
  - Stack the cards in one spot. Give each an offset o from the middle of the hand (negative to the left, positive to the right) and rotate it by o × 8° around a pivot far below the hand (transform-origin: 50% 200%), so the hand falls into an arc.
  - Layer them with z-index so each card sits on top of the one to its left.

  2. Picking a card up
  - Build each card from three nested layers: a slot that keeps its place in the fan and takes the pointer, a lift layer inside it, and a tilt layer inside that.
  - Only the inner layers move, so the slot never slides out from under the pointer and the hover doesn't flicker.
  - Hovering, touching or focusing a card lifts it: translateY(-22px), a rotation that cancels the fan's so it stands upright, scale(1.06), a stronger shadow, and a z-index above the rest.
  - Its neighbours move 18 px away to each side.
  - Animate all of this over 0.45 s on a spring curve that overshoots slightly.

  3. Tilt and glare
  - On pointer move, write the pointer's position on the card into two CSS variables, --x and --y (-0.5 to 0.5), straight onto the element. Don't re-render.
  - Map them to perspective(600px) rotateX(--y × -16°) rotateY(--x × 16°), with a 0.2 s ease-out.
  - Add a glare: a white radial gradient twice the card's size that follows the pointer with translate and only shows on the lifted card.
  - On leave or blur, reset both variables to 0.

  4. Input and accessibility
  - Each card is focusable with a visible focus ring, and focus lifts it like hover.
  - On touch, use touch-action: pan-y so vertical swipes still scroll the page.
  - The card images are decorative unless the cards carry meaning in my product.

  5. Done when
  - The hand reads as an arc, a lifted card never flickers at its edges, and its neighbours make room.
  - The tilt follows the pointer smoothly, with no re-renders on pointer move.
  - It works with mouse, touch and keyboard, in light and dark themes.
  - You tell me every file you added or changed.
---
