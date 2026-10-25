# B737 Classic — five-pose cockpit toggle (TGL-0002)

User-approved straight-down 90° orthographic switch with glossy white tip. Five precise poses: LEFT, CENTER (knob faces camera), RIGHT, UP, DOWN. **The metal mounting disc is identical in every frame and never moves.**

Asset: `b737-toggle-five-positions.webp`, transparent atlas 560 × 112, five adjacent 112 × 112 cells (LEFT, CENTER, RIGHT, UP, DOWN). Frame order must not be changed. The entire original locked V1 family and frozen mosaic remain untouched. Vertical state mappings: UP/ON → frame 3; CENTER/OFF (for 3-state) → frame 1; DOWN/OFF (for 2-state) → frame 4. Horizontal: LEFT → 0, NORMAL → 1, RIGHT → 2. Motion and systems state are still governed by the existing per-switch model, not these pictures.

Source SHA-256: `3f18c9fc0835e877060f086c7bc67f96e191b93ad0569a07afb7e62296b0213c`.
