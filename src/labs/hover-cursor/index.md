---
title: Context Cursor
summary: A cursor that changes shape, colour and icon for each kind of target.
tags: [React, CSS]
date: 2025-01-17
order: 7
prompt: >-
  Build a React grid of tiles with a context cursor. Inside the stage, hide the real cursor and have a circle
  follow the pointer, writing its position straight to its transform on every move without a React render. Each
  tile has a kind: over one, the circle takes that kind's colour, grows from a dot to a disc with scale, and
  shows that kind's icon. Icons come in from the bottom left and leave to the top right, and the old one stays
  until it has left, so moving between tiles never leaves a gap. Tabbing to a tile moves the cursor there too.
---
