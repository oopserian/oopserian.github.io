---
title: 3D Hover Card
summary: A fanned hand of cards. Hover one and it straightens, lifts and tilts toward the pointer.
tags: [Motion, Tailwind]
date: 2025-01-10
order: 2
---

The fan comes from Motion variants: each card's rotation and offset is worked out from its distance to the middle of the hand. On hover the card's variant flips to a straight, raised pose.

Inside, the card tilts with `rotateX` and `rotateY` under a 500px perspective, following the pointer's offset from its centre. A blurred white spot follows the pointer to fake a reflection.
