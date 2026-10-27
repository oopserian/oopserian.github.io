---
title: Hover Cursor
summary: A cursor that changes shape and colour for each kind of target.
tags: [Motion, Tailwind]
date: 2025-01-17
order: 7
---

The real cursor is hidden and a `div` follows the pointer instead. Each target says what kind it is; the cursor animates between Motion variants for size and colour.

The icon inside slides in from the bottom left and out to the top right with `AnimatePresence` in `popLayout` mode, so moving from one target to the next swaps icons without a gap.
