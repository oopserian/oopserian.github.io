---
title: Context Cursor
summary: A cursor that changes shape, colour and icon for each kind of target.
tags: [React, CSS]
date: 2025-01-17
order: 7
---

Inside the stage the real cursor is hidden and a circle follows the pointer instead. Its position is written straight to its `transform` on every move, without a React render, so it never lags behind.

Each tile has a kind. Over one, the circle takes that kind's colour and grows from a dot to a disc with `scale`, so nothing is laid out again. The icon inside comes in from the bottom left and leaves to the top right, and the old one stays until it has left, so moving between tiles never leaves a gap. Tab to a tile and the cursor jumps there too.
