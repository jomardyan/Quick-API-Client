---
name: material3-surfaces-feedback
description: 'Choose Material Design 3 surfaces and feedback patterns for web. Use for dialogs, sheets, cards, dividers, progress indicators, badges, banners, snackbars, tooltips, and status messaging.'
argument-hint: 'Describe the message, interruption, or container problem you want to solve with Material 3.'
---

# Material 3 Surfaces And Feedback

## When to Use
- Choosing between modal, inline, transient, and persistent feedback patterns
- Designing surface hierarchy with elevation, outlines, and grouping
- Mapping dialogs and progress states to Material Web components
- Auditing status messaging for clarity and accessibility

## Procedure
1. Identify the interruption level.
   - Decide whether the feedback is blocking, transient, persistent, inline, or decorative.
2. Pick the surface or message pattern.
   - Use dialogs for blocking decisions, sheets for supplemental flows, progress indicators for status, and banners, snackbars, or tooltips for lighter-weight messaging.
   - Use cards, dividers, and elevation to organize content and hierarchy.
3. Use the Material Web repository as the implementation source of truth.
   - Start from `https://github.com/material-components/material-web/`, including `docs/components`, token files, labs, and catalog implementations.
   - Public package elements for this family include `md-dialog`, `md-divider`, `md-elevation`, `md-circular-progress`, and `md-linear-progress`.
   - The same repository also contains token sets and supporting implementations for cards, badges, banners, snackbars, tooltips, sheets, top app bars, bottom app bars, and related surface patterns. When recommending code, label whether the path is a public `@material/web` import, a labs or catalog composition, or a token-driven custom composition.
4. Define behavior and tone.
   - Decide whether the surface is dismissible, auto-dismissed, anchored, modal, stacked, or queued.
5. Map token usage.
   - Start with system tokens for surface, outline, shadow, and type.
   - Add component tokens such as `--md-dialog-*`, `--md-divider-*`, `--md-elevation-*`, and progress tokens only where needed.
6. Validate accessibility.
   - Check focus trap and focus return, announcement timing, reduced motion, progress semantics, and clear escape paths.

## Heuristics
- Use dialogs sparingly and only when the interruption justifies modality.
- Use elevation and surface roles to communicate layer and importance, not decoration.
- Feedback components need accessible announcements as much as visual styling.

## References
- Material 3 components index: https://m3.material.io/components
- Material Web repository root: https://github.com/material-components/material-web/
- Material Web component docs: https://github.com/material-components/material-web/tree/main/docs/components
- Material Web roadmap: https://github.com/material-components/material-web/tree/main/docs/roadmap.md