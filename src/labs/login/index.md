---
title: Sign-in Form
summary: A compact sign-in card. Try signing in with a field left empty.
tags: [React, CSS]
date: 2025-01-08
inspiration: https://x.com/guerriero_se/status/1780963026918637653
order: 6
prompt: |-
  Add a compact sign-in card to my project: the focused field lifts out of its panel, empty fields turn red and shake, and the button shows progress. Build it with my existing framework, form handling and design system.

  0. Start from what exists
  - Find my current sign-in form, its validation and its submit handler. Keep its copy, its auth call and its error messages; change only how the fields and the button behave.

  1. Layout
  - Put both fields in one inset panel (a sunken background with a 1px inner line) with a hairline between them. Hide the hairline next to the focused field.
  - Each field is a label wrapping a leading icon and the input. The password field also has a show and hide button with aria-pressed.

  2. One colour per field
  - Give each field one colour variable, --tone: my accent normally, and my danger colour when the field is invalid. The border, icon and placeholder all read from --tone, so they change together.
  - The focused field lifts out of the panel: a z-index above the other field, the card's surface colour, scale(1.025), a 1px ring in --tone, and a soft shadow tinted with --tone.

  3. Submitting
  - Submitting with a field empty marks each empty field invalid (aria-invalid and the red --tone) and shakes the panel with the Web Animations API: translateX through 0, -6, 5, -3, 2 and 0 px over 360 ms. Skip the shake under prefers-reduced-motion.
  - Typing in an invalid field clears its error.
  - With both fields filled, the button shows a spinner while the request runs, then turns my success colour with a check and a short message. Ignore further submits while it is busy.

  4. Details
  - On touch devices, make the inputs 16 px so Safari doesn't zoom the page on focus.
  - The button has aria-live="polite", so the busy and done states are announced.

  5. Done when
  - Focus moves cleanly between the fields, and only one field is lifted at a time.
  - The error, busy and done states all work with the keyboard alone.
  - It works in light and dark themes.
  - You tell me every file you added or changed.
---
