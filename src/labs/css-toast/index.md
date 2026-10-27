---
title: Toast Stack
summary: Notifications that stack the way Sonner's do. Hover the stack to spread it, add more to push the oldest out.
tags: [React, CSS]
date: 2025-01-16
inspiration: https://sonner.emilkowal.ski/
order: 3
---

Each toast only knows its place in the stack, passed in as `--i`. CSS does the rest: older ones shrink by 5% a step, peek out 10px above the newest and hide their text. Hovering the list, focusing it or tapping it moves each toast up by `--i` toast heights, and the stack spreads into a column.

New toasts slide in from below with `@starting-style`, no JavaScript timing involved. Three fit; the fourth shrinks and fades away, and is taken out of the list when its fade ends.
