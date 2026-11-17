---
title: Select & Zip
summary: Drag a box across files and the count rides your cursor, then grows into an action bar. Compress pulls the picks into one archive; select the archive to let them out again.
tags: [Pointer Events, Springs, CSS]
date: 2026-11-17
order: 16
prompt: |-
  Add a marquee selection to my project: a folder window of files where you drag a box across them, the number selected rides beside the pointer as a small pill, and on release the pill flies down and grows into a floating action bar. Compress pulls the selected files into the bar's button and drops a single archive back into the grid; select the archive and the same button extracts it. Build it with plain DOM and pointer events in my existing framework, with no animation library: one script for the folder, the selection and the bar, one for small motion helpers (a spring, rolling text, an arc flight), and a thin component that renders the skeleton once.

  0. Start from what exists
  - Find my file or list components, my button and icon components, my design tokens for colour, radius, shadow and easing, and how my site switches between light and dark. Reuse them; don't add a second theme signal.
  - If my styles include a utility framework such as Tailwind, don't give elements class names that are also utilities (ring, grid, hidden), or its rules will land on them.

  1. One stage, three arrangements
  - Lay everything out in design pixels inside one inner box and scale that box with a CSS transform to fit the container, keeping 30 px at the bottom for a hint line (none when the hint is hidden). Inside it, a window (radius 24, a 1 px line and my smallest shadow) with a 42 px header holding a small folder in my accent colour, the folder's name and an "8 items" count, then the files; 14 px under the window, centred, the slot for the bar.
  - The window holds at most 8 files, in one of three grids: 4 × 2 with 104 px columns, 3 × 3 with 112 px columns, or 8 × 1 with 104 px columns. Rows are 96 px, the window has 10 px at the sides and 8 px at the bottom, and the bar is 52 px tall. For each grid the scale is min(1.4, width ÷ (columns × column + 44), height ÷ (rows × 96 + 130)); use the one that makes the files biggest, and on a tie prefer 4 × 2, then 3 × 3. The grid keeps room for all 8 slots, so the window never changes size as files come and go.
  - Each file is a box the column minus 4 px wide and 88 px tall: a 64 px icon cell with my medium radius, and 6 px below it an 18 px name label (12 px text, 6 px padding). A name that doesn't fit is shortened in the middle and keeps its extension, like the Finder does: DSC_8647.JPG becomes DSC_…647.JPG. Measure it with the label's real font.

  2. The files
  - Sort by name the way the Finder does: compare the names without their extensions first, numbers by value, so Archive.zip comes before Archive 2.zip.
  - Use real photographs for the image files, mine if I give you some: save small copies (about 2× their shown size) with the EXIF stripped, and show each at its real aspect ratio, 58 px wide if landscape and 52 px tall if portrait, with square corners and a 2 px white border like a print.
  - Draw every other file as a page in one quiet grey: a 36 × 44 page with a folded top-right corner, filled one step darker than the window, a 1.5 px line, a small glyph that says what it is (lines of text, a table, a curve with anchors, a route, a zipper) and the extension in my mono font. No colour per file type; the only colour is the photos and the accent on what's selected.
  - Give each file a real size and how much of it survives zipping: photos 98%, office files that are already zipped about 90%, a PDF 86%, a design file 58%, a GPS track or plain text 14%. The archive's size is the sum, so the saving shown is honest and depends on what you picked.

  3. Drawing the box
  - Start on pointer down anywhere in the window. With a mouse, the box opens after 4 px of movement. Put touch-action: pan-y on the window: on touch, the box opens only once the finger has moved 8 px and more sideways than up or down, so a vertical swipe still scrolls the page (the browser takes it over with pointercancel; if no box was opened yet, change nothing).
  - The box is a 1 px accent border over my accent's soft tint, square, clamped to the area under the header. Every file whose box it touches is selected; Shift, ⌘ or Ctrl adds to the existing selection instead of replacing it.
  - A tap that never opened a box toggles the file under it, or clears everything on empty space. A press outside the window clears too.
  - Selected: the icon cell gets a 7% tint of my text colour and the label becomes an accent pill with my small radius.

  4. The count, then the bar
  - While the box is open and holds something, the count is an accent pill 24 px tall and max(24, 14 + 7.4 × digits) px wide, its centre 14 px + half its width right of and 30 px below the pointer, or 34 px left of and 46 px above a finger so the finger doesn't cover it, and always 6 px inside the stage. Its digits roll up or down as the number changes. When the box holds nothing it fades out where it is.
  - The bar is one element. Keep it at its full size, move it with transform, and reveal a rounded rectangle from its centre with clip-path: inset(… round h ÷ 2), so a 24 px pill and the full bar are the same element and nothing but transform and clip-path animates. The clip also cuts off box-shadow, so cast its shadow with filter: drop-shadow on a wrapper, and make the clipped layer 8 px larger all round so an overshoot isn't cut flat.
  - Drive position, width and height with springs that run on real frame time. Riding the pointer: position 0.11 s with no bounce, size 0.3 s with 0.32 bounce. On release the targets switch to the slot and the full size, position 0.52 s with 0.16 bounce and size 0.46 s with 0.14 bounce, so the pill carries the pointer's momentum down into the bar instead of starting over. The colour crossfades from accent to the bar's colour over 0.25 s, and the bar's contents fade in from a 4 px blur 80 ms later.
  - A tap or a key that selects with no bar showing grows the bar from a small pill at its own slot. Clearing shrinks it to 60% where it is and fades it.
  - The bar is my text colour with my surface colour for its contents, so it's dark in light mode and light in dark mode. It's min(336, window width − 12) px wide: a round × to clear, a title and a line under it, then Copy link, Compress and Delete as 40 px round icon buttons. The title is the file's name when one is selected and "N selected" otherwise; the line is their total size. Copy link swaps its icon for a check and the title for "Link copied" for 1.6 s.
  - Every text change rolls letter by letter: letters both words share stay put, digits slide by direction, the rest crossfade with a little blur, and each letter's width eases so the text after it slides instead of jumping.

  5. Compress and extract
  - Compress: copies of the selected icons fly into the Compress button along an arc 36 px high, 540 ms each and 70 ms apart, shrinking to 26% on an ease that is slow to leave and quick to arrive, fading over the last quarter; the button pulses to 1.16 as each one lands. 140 ms in, the originals leave the grid and the other files slide to their new places (500 ms on my standard curve, 24 ms apart), leaving the archive's sorted slot empty.
  - Then a ring around the button fills over 900 ms while the size under the title counts down in six steps to the archive's size. The archive pops out of the button into its slot along an arc 80 px high, 660 ms, scaling from 0.3 to 1 with a slight overshoot and fading in over the first fifth. It lands selected: the title rolls to its name and "· N% smaller" fades in after the size.
  - Name it Archive.zip, or Archive 2.zip, 3 and so on: the first name not used anywhere, including inside other archives and among deleted files, so extracting never makes two files with one name. An archive keeps the files it holds.
  - When exactly one archive is selected, the Compress icon turns into Extract (the two icons swap with a turn and a blur). Extract is the reverse: the archive flies into the button, the others make room for its files, a 600 ms ring, then the files pop out to their sorted slots 80 ms apart and end up selected.
  - While it works, the other buttons dim to 35% and the window ignores input.

  6. Delete and undo
  - Delete blurs the selected files by 6 px, shrinks them to 70% and fades them; 120 ms later the rest close the gap. The bar narrows to 272 px and reads "N files deleted" with an Undo button for 5 seconds, then tucks away. Starting a new selection ends the chance to undo.
  - Undo brings the files back to their sorted slots, out of the blur, selected. If the folder is left empty, show "This folder is empty" and a Put Back button that restores everything deleted.

  7. Keyboard, accessibility and cost
  - The grid is a listbox with aria-multiselectable, each file an option with aria-selected, and one roving tabindex. Arrow keys move by one or by a row, Home and End jump, Space or Enter toggles, Shift with an arrow extends, ⌘A or Ctrl+A selects all, Escape clears, Delete or Backspace deletes. Tab goes from the grid into the bar.
  - After an action started from the keyboard, put focus on its result: the new archive, the first extracted file, the first restored file, or the neighbour of what was deleted. Hidden parts of the bar are inert. Announce selections and results in a polite live region, since rolling text is read badly letter by letter.
  - Run requestAnimationFrame only while a spring is moving or something is flying.
  - Under prefers-reduced-motion, springs don't overshoot and settle within 0.12 s, flights and rolling text are instant, and waits shrink to a moment.
  - Put a one-line hint at the bottom, worded for mouse ("Drag across the files to select them") and for touch ("Swipe sideways across the files to select").

  8. Done when
  - The count follows the pointer while you draw, and on release it flies into the bar in one unbroken motion.
  - Compressing pulls the files into the button, the size counts down with the ring, and the archive lands in the slot the grid left for it; extracting puts every file back where it was.
  - Mouse, touch and keyboard can all select, compress, extract, delete and undo, in both themes and in all three arrangements, a vertical swipe still scrolls the page, nothing leaves the stage and the console stays clean.
  - You tell me every file you added or changed.
---
