---
title: Progressive Blur
summary: A blur that builds up from a sharp centre to a heavy rim. Click the photo.
tags: [React, CSS]
date: 2025-02-28
order: 1
prompt: >-
  Build a React component: a photo that gets a progressive blur when clicked, sharp in the centre and heavy at
  the rim. Stack six overlay layers on the photo, each with its own backdrop-filter: layer n blurs by 2^n px
  (2px up to 64px) and is masked with a radial gradient whose clear centre grows 12% per layer. Stacked backdrop
  filters are expensive, so the layers only exist while the effect is on: a click mounts them transparent, fades
  them in on the next frame, and unmounts them once they have faded out again.
---
