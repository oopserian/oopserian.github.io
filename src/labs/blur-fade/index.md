---
title: Progressive Blur
summary: A blur that builds up from a sharp centre to a heavy rim. Click the photo.
tags: [React, CSS]
date: 2025-02-28
order: 1
---

Six layers sit on top of the photo, each with its own `backdrop-filter`. Layer *n* blurs by 2<sup>n</sup> pixels, from 2px up to 64px, and is masked with a radial gradient whose clear centre grows by 12% per layer. Stacked together, the blur goes from nothing in the middle to heavy at the rim.

Every layer blurs whatever is underneath it again, so they are expensive. They only exist while the effect is on: a click mounts them transparent, fades them in on the next frame, and removes them once they have faded out again.
