---
name: material3-actions-inputs
description: 'Choose and implement Material Design 3 action and input components for web. Use for buttons, icon buttons, FABs, chips, text fields, selects, checkboxes, radios, switches, sliders, validation, and interactive state design.'
argument-hint: 'Describe the action, form, or selection problem you want to solve with Material 3 components.'
---

# Material 3 Actions And Inputs

## When to Use
- Choosing between action, selection, and text-entry controls
- Mapping form fields to Material Web components
- Reviewing interactive states, helper text, and validation behavior
- Converting mockups into implementation-ready control choices

## Procedure
1. Classify the user need.
   - Trigger an action, enter text, choose one option, choose many options, or adjust a value range.
2. Pick the right Material pattern.
   - Buttons for consistent calls to action.
   - Icon buttons for compact icon-only actions.
   - FABs for the single most important screen-level action.
   - Chips for grouped, dynamic actions or filters.
   - Checkboxes, radios, switches, sliders, selects, and text fields for structured input.
3. Select the emphasis and state model.
   - Use text, outlined, filled, tonal, or elevated emphasis intentionally.
   - Define enabled, disabled, focused, hovered, pressed, selected, error, and loading states.
4. Map to Material Web components.
   - Buttons: `md-elevated-button`, `md-filled-button`, `md-filled-tonal-button`, `md-outlined-button`, `md-text-button`
   - Icon buttons: `md-icon-button`, `md-filled-icon-button`, `md-filled-tonal-icon-button`, `md-outlined-icon-button`
   - FABs: `md-fab`, `md-branded-fab`
   - Chips: `md-chip-set`, `md-assist-chip`, `md-filter-chip`, `md-input-chip`, `md-suggestion-chip`
   - Inputs: `md-filled-text-field`, `md-outlined-text-field`, `md-filled-select`, `md-outlined-select`, `md-select-option`, `md-checkbox`, `md-radio`, `md-switch`, `md-slider`
5. Define token usage.
   - Start with `--md-sys-color-*`, `--md-sys-shape-*`, and `--md-sys-typescale-*`.
   - Add component tokens only where needed, such as `--md-text-button-*`, `--md-checkbox-*`, `--md-switch-*`, and `--md-filter-chip-*`.
6. Validate the interaction.
   - Check helper text, error messaging, keyboard behavior, focus rings, target sizes, and clear selection states.

## Heuristics
- Buttons are stable, familiar actions; chips are dynamic, grouped, and context dependent.
- Switches are for immediate on or off changes; checkboxes are for multi-select decisions that may be submitted later.
- Use bundle imports only for quick prototypes; prefer individual `@material/web/...` imports for production.

## References
- Material 3 components index: https://m3.material.io/components
- Material Web component docs: https://github.com/material-components/material-web/tree/main/docs/components
- Material Web README and quick start: https://github.com/material-components/material-web/tree/main/README.md