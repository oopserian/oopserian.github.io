---
title: Blur Fade
summary: A progressive blur that thickens toward the edges. Click the photo.
tags: [React, Tailwind]
date: 2025-02-28
order: 1
---

Ten layers sit on top of the image, each with its own `backdrop-filter`. Layer *n* blurs by 2<sup>n</sup> pixels and is masked with a radial gradient whose clear centre grows by 8% per layer, so the blur stacks up from nothing in the middle to heavy at the rim.

Turning it on just transitions every layer's `backdrop-filter` at once. No canvas, no shader.
