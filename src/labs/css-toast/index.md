---
title: CSS Toast
summary: A stack of toasts in the style of Sonner, laid out almost entirely in CSS. Hover to spread them.
tags: [CSS]
date: 2025-01-16
inspiration: https://sonner.emilkowal.ski/
order: 3
---

Each toast only knows its position in the stack, passed in as `--index`. CSS does the rest: older toasts shrink by 5% per step and tuck behind the newest one, because the gap between them is negative.

Hovering the list changes a single variable, `--gap`, from `-80%` to `0.5rem`, and every toast slides into a readable column. New toasts drop in with a little 3D tilt; the fifth one fades out.
