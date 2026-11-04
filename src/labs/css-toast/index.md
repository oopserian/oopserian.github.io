---
title: Toast Stack
summary: Notifications that stack the way Sonner's do. Hover the stack to spread it, add more to push the oldest out.
tags: [React, CSS]
date: 2025-01-16
inspiration: https://sonner.emilkowal.ski/
order: 3
prompt: |-
  Add a toast stack to my project that behaves like Sonner's: new toasts stack in front, older ones tuck behind, and hovering the stack spreads it into a list. Let CSS do the layout; script only adds and removes toasts. Build it with my existing framework and design system, and reuse my toast component if I have one.

  0. Start from what exists
  - Find my current toast or notification component and where toasts are triggered. Keep its look and copy; change only how the stack is laid out.

  1. Layout from one variable
  - Render the toasts in an ordered list, absolutely positioned at its bottom. Each toast knows only its place in the stack, as --i (0 is the newest, in front).
  - Stacked: translateY(--i × -10px) and scale(1 - --i × 0.05), so each older toast peeks 10 px above the one in front of it and is 5% smaller. z-index falls as --i grows. Hide the content of every toast but the front one.
  - Spread: on :hover, on :focus-within, or when a touch has opened it, move each toast up by --i × (toast height + gap) and show all content.
  - Give the list a fixed height that fits three spread toasts, so moving the pointer between them never leaves the list and collapses it.
  - Transition transform over 0.45 s with my ease-out curve.

  2. Coming and going
  - New toasts slide in from below with @starting-style (from translateY(70%), scale 0.96 and opacity 0).
  - Keep three. When a fourth arrives, mark the oldest as leaving: it shrinks to 0.8 and fades out, and it is removed from the list when its opacity transition ends.
  - Cap the array, so fast clicking never piles up toasts that haven't finished leaving.

  3. Input and accessibility
  - On touch there is no hover: a tap on the stack opens and closes it.
  - The list is focusable and has aria-live="polite". Toasts that are leaving are aria-hidden.
  - Long titles and messages end in an ellipsis instead of wrapping.

  4. Done when
  - Adding toasts quickly never shows more than three, and the oldest leaves smoothly.
  - Hover, focus and tap all spread and collapse the stack.
  - It works in light and dark themes, and under reduced motion the changes are instant.
  - You tell me every file you added or changed.
---
