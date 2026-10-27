---
title: Folder
summary: A folder that opens and fans out the photos inside. Hover or tap it, then pick a photo.
tags: [React, CSS, SVG]
date: 2025-01-08
order: 5
---

The back of the folder, tab included, is a single SVG path, so it scales as one shape. The front is a plain element that tips back on its bottom edge under `perspective`. Both colours are mixed from the site's accent with `color-mix()`: lighter in light mode, deeper in dark.

Opening slides the three photos up and fans them out on a slightly overshooting curve, 50ms apart. Point at one, or tap it, to lift it further. It stays behind the front, so it still looks like it is inside the folder.
