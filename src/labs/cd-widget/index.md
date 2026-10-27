---
title: CD Player
summary: A music widget where the cover art is the disc. Press play.
tags: [React, CSS]
date: 2025-01-10
inspiration: https://x.com/sovpal/status/1828542375372656894
order: 4
---

The cover is cropped into a circle and pushed up so only its lower half shows. Playing spins it with a CSS animation and runs the progress bar; pausing sets `animation-play-state: paused`, so both stop where they are instead of jumping back to the start.

The rings of the hub are one radial gradient, and a streak of light that doesn't turn sits on top, so the spinning cover reads as a shiny disc. Behind everything, a blurred copy of the cover tints the card. It is blurred once and stays still; only the disc moves.
