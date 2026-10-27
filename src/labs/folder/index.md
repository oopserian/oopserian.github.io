---
title: Folder
summary: A folder that opens on hover and fans out the photos inside.
tags: [CSS, SVG]
date: 2025-01-08
order: 5
---

The folder's back is one SVG path used as a clip-path, so the tab and the rounded corners scale together. The front flap is a plain `div` that rotates back on its bottom edge with `perspective`.

The three photos slide up and fan out with a slightly overshooting `cubic-bezier`, staggered by 100ms. Hover a photo to pull it to the front.
