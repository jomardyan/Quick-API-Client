---
name: material3-foundations
description: 'Plan or review Material Design 3 foundations for web. Use for color roles, typography, shape, elevation, motion, density, accessibility, and design token decisions before building Material components.'
argument-hint: 'Describe the product, screen, or design system decision to map into Material 3 foundations.'
---

# Material 3 Foundations

## When to Use
- Choosing or auditing an M3 theme
- Translating brand styles into Material tokens
- Reviewing a UI for Material consistency before component work
- Preparing implementation-ready theming guidance for Material Web

## Procedure
1. Identify the product constraints.
   - Note platform, screen sizes, brand inputs, theme modes, density needs, and accessibility targets.
2. Build the token hierarchy.
   - Start from reference values when brand colors or typefaces are provided.
   - Map them to system tokens such as `--md-sys-color-*`, `--md-sys-typescale-*`, `--md-sys-shape-*`, `--md-sys-elevation-*`, and `--md-sys-state-*`.
   - Use component tokens only for targeted exceptions.
3. Define surface model and emphasis.
   - Choose surface, surface-container, primary, secondary, tertiary, outline, and shadow roles.
   - Assign shape and elevation consistently across related surfaces.
4. Set typography, spacing, and density.
   - Pick type roles by function, not by arbitrary size.
   - Confirm tap targets, readable density, and layout rhythm across breakpoints.
5. Validate accessibility and state behavior.
   - Check contrast, focus visibility, hover and pressed states, reduced motion, and keyboard support.
6. Produce implementation-ready output.
   - Return token recommendations, CSS variable examples, and any component-level caveats.

## Heuristics
- Prefer system tokens for brand-wide decisions and component tokens for local overrides.
- Keep color, shape, and elevation changes coherent across an entire family of surfaces.
- Material Web theming is driven by CSS custom properties and can be scoped at `:root` or a feature container.

## References
- Material 3 web guidance: https://m3.material.io/develop/web
- Material foundations: https://m3.material.io/foundations
- Material Web theming docs: https://github.com/material-components/material-web/tree/main/docs/theming