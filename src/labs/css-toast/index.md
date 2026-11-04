---
title: Toast Stack
summary: Notifications that stack the way Sonner's do. Hover the stack to spread it, add more to push the oldest out.
tags: [React, CSS]
date: 2025-01-16
inspiration: https://sonner.emilkowal.ski/
order: 3
prompt: >-
  Build a React toast stack that behaves like Sonner's, with CSS doing the layout. Each toast only gets its
  place in the stack as --i: older ones shrink 5% per step, peek out 10px above the newest and hide their text.
  Hovering, focusing or tapping the list moves each toast up by --i toast heights, so the stack spreads into a
  column. New toasts slide in from below with @starting-style. Keep three; a fourth makes the oldest shrink and
  fade, and it is removed when its transition ends.
---
