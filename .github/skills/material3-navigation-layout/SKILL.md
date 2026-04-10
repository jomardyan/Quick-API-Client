---
name: material3-navigation-layout
description: 'Choose Material Design 3 navigation and layout patterns for web. Use for app bars, tabs, drawers, navigation bars and rails, search, lists, menus, sheets, and responsive navigation structure.'
argument-hint: 'Describe the screen hierarchy, destinations, or navigation problem to solve with Material 3.'
---

# Material 3 Navigation And Layout

## When to Use
- Choosing a primary or secondary navigation pattern
- Designing responsive layouts and overflow behavior
- Mapping navigation UI to Material Web components where available
- Reviewing information architecture against Material 3 navigation guidance

## Procedure
1. Identify the navigation scope.
   - Decide whether the need is global, local, contextual, or temporary.
2. Pick the pattern.
   - Use tabs for sibling views in one context.
   - Use menus for overflow and transient actions.
   - Use lists for structured navigation or content collections.
   - Use app bars, drawers, rails, navigation bars, search, and sheets for higher-level wayfinding and layout.
3. Use the Material Web repository as the implementation source of truth.
   - Start from `https://github.com/material-components/material-web/`, including `docs/components`, token files, labs, and catalog implementations.
   - Public package elements for this family include `md-tabs`, `md-primary-tab`, `md-secondary-tab`, `md-list`, `md-list-item`, `md-menu`, `md-menu-item`, and `md-sub-menu`.
   - The same repository also contains navigation-bar, navigation-drawer, navigation-rail, top-app-bar, search, and sheet token sets and implementation examples. When recommending code, label whether the path is a public `@material/web` import, a labs or catalog composition, or a token-driven custom composition.
4. Compose hierarchy and responsive behavior.
   - Define destination count, breakpoint shifts, scroll behavior, and when content should collapse into overflow or drawers.
5. Map tokens and surfaces.
   - Use system color, typography, shape, and elevation tokens first, then add tab, list, or menu tokens for local refinement.
6. Validate navigation quality.
   - Check active indicators, labels, keyboard navigation, focus restore, and clear announcements for opened surfaces.

## Heuristics
- Do not mix multiple primary navigation patterns on the same breakpoint without clear role separation.
- Prefer tabs for peer content sections and menus for actions or overflow.
- Keep labels visible whenever icon meaning is not guaranteed.

## References
- Material 3 components index: https://m3.material.io/components
- Material Web repository root: https://github.com/material-components/material-web/
- Material Web component docs: https://github.com/material-components/material-web/tree/main/docs/components
- Material Web roadmap: https://github.com/material-components/material-web/tree/main/docs/roadmap.md