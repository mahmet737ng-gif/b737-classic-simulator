# 737-400 Unified OH21 dual RECIRC implementation
Release: 2026-10-26

## Variant-only visual change
- Two matching title placards, L RECIRC FAN and R RECIRC FAN, share equal dimensions, font weight, and title baseline.
- Matching OFF/AUTO placards are installed on each side.
- Both existing and new toggle pivots are calibrated for OFF/up clearance; both are interactive in the Unified overhead.
- The additional native "RECIRC FAN" hover tooltip is suppressed in the 737-400 variant.
- The original OH21 image and 737-300/500 configuration are unchanged.
- Both 737-400 PACK caution lenses replace text only, keeping their pneumatic warning input.

## Browser evidence and QA
- Chromium run: https://github.com/mahmet737ng-gif/b737-classic-simulator/actions/runs/40252829289
- Includes original photo decoded, BOTH recirc switches operated independently, both OFF/up physical poses,
  matching title and detent bounding boxes, original 300/500 fallback, and screenshots.
- Strict OH21 circuit/geometry test: tests/aircon-400-oh21-variant.test.cjs.
- No file under panel-mosaic-lab/assets/locked/ is changed by this installation.

## Scope
This is a simulator-only visual and interaction adaptation, not a certified Boeing panel
or aircraft wiring reference. Other avionics/system regressions remain governed by the
separate repository-wide quality gates.
