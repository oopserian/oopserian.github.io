---
title: Sign-in Form
summary: A compact sign-in card. Try signing in with a field left empty.
tags: [React, CSS]
date: 2025-01-08
inspiration: https://x.com/guerriero_se/status/1780963026918637653
order: 6
---

Both fields sit in one inset panel. The focused one lifts out of it: it scales up a little, takes on the colour of the card and picks up a tinted shadow.

Each field has a single colour variable, `--tone`. If it is empty when you sign in, `--tone` turns red, so the border, the icon and the placeholder change together, and the panel shakes through the Web Animations API (not if you prefer reduced motion). Fill in both and the button shows a spinner, then a check.
