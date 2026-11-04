---
title: Context Cursor
summary: A cursor that changes shape, colour and icon for each kind of target.
tags: [React, CSS]
date: 2025-01-17
order: 7
prompt: |-
  Add a context cursor to an area of my project: inside it, the system cursor is replaced by a circle that follows the pointer and changes colour, size and icon over each kind of target. Build it with my existing framework and design system.

  0. Start from what exists
  - Find the area this goes in and the targets inside it. Give each target a kind (for example search, refresh, delete and verify), each mapped to a colour and an icon from my design system.

  1. Following the pointer
  - Hide the real cursor only inside the area and only for fine pointers: @media (pointer: fine) { cursor: none }.
  - The circle sits in an outer element that is positioned only by transform. On every pointer move, write translate3d(x, y, 0) straight to it. Don't re-render on move.
  - It fades in when the pointer enters the area and out when it leaves.

  2. Changing with the target
  - The inner circle is 44 px. Away from targets it is scaled down to 0.27, a small dot in my foreground colour. Over a target it scales to 1 on a slightly springy curve and takes that kind's colour.
  - Change its size only with scale, never width or height, so nothing has to be laid out again.
  - Icons come in from the bottom left and leave to the top right. The old icon stays until its exit transition ends, so moving between targets never shows an empty circle. Keep at most four in the DOM.
  - The targets themselves rise 2 px and get a stronger shadow on hover and focus.

  3. Keyboard and touch
  - Tabbing to a target moves the circle to its centre and shows that kind. Focus that comes from a mouse click doesn't move it.
  - On touch, pressing a target shows the circle there, and lifting the finger hides it.

  4. Done when
  - The circle tracks the pointer with no lag and no re-renders on move.
  - Moving between targets never shows an empty circle.
  - The real cursor is never hidden outside the area or on touch devices.
  - It works in light and dark themes, and under reduced motion the changes are instant.
  - You tell me every file you added or changed.
---
