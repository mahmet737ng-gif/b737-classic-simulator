# Final overhead mosaic lock — owner instruction

The owner approved UPD-0012 on 2026-10-24 and explicitly ordered:
«همین رو فیکس و نهایی کن و تحت هیچ شرایطی نباید تغییر کنه»

- The overhead mosaic at `panel-mosaic-lab/all-overhead/` is FINAL and FROZEN.
- Preserve all OH-01 through OH-25 images, source pixels, dimensions, positions,
  order, crop rectangles, row registration, seams, renderer, styles and behavior.
- Do not redesign, improve, regenerate, replace, rename or move this mosaic or
  any locked image it references. Do not apply broad refactors to these files.
- The exact frozen file set and SHA-256 values are in
  `panel-mosaic-lab/all-overhead/final-lock.json`.
- Preserve that manifest, `panel-mosaic-lab/verify-final-overhead.py`, and the
  verification step in `.github/workflows/pages.yml`. Never update expected
  hashes or remove the guard to make a failing change pass.
- Future simulator work must live outside the frozen mosaic and must preserve
  the appearance and behavior of its existing public URL.
- Before publishing any repository change, run:
  `python3 panel-mosaic-lab/verify-final-overhead.py`.

Approved visual commit: `9cd1273f281f03785db4a47dfd0420f8132f677e`.
