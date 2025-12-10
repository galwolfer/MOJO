# Components

This file documents the UI components in `frontend/components`.
Update this file whenever you add, remove, or change a component.

- `AppText.tsx` — `frontend/components/AppText.tsx`
   - Text wrapper that applies the app's `TYPOGRAPHY` presets. Use `variant` to pick a preset (e.g. `title`, `bodyText`, `notes`). Centralizes typography.

- `Box.tsx` — `frontend/components/Box.tsx`
   - A surfaced card with a styled title bar and content. Use to group UI into distinct sections. Title uses `title3` typography.

- `Checkbox` (web) — `frontend/components/icons/Checkbox.tsx` or `frontend/components/Checkbox.tsx`
   - Web checkbox (animated) using `motion/react`. Mirrors native checkbox behavior.

- `Checkbox.native.tsx` (native) — `frontend/components/icons/Checkbox.native.tsx` or `frontend/components/Checkbox.native.tsx`
   - Native checkbox for mobile using `Animated` + `react-native-svg`.

- `ProgressIcon` (web) — `frontend/components/icons/ProgressIcon.tsx` or `frontend/components/ProgressIcon.tsx`
   - Web progress/status icon with SVG animation; morphs into a check at 100%.

- `ProgressIcon.native.tsx` (native) — `frontend/components/icons/ProgressIcon.native.tsx` or `frontend/components/ProgressIcon.native.tsx`
   - Native mobile version of the progress icon using `Animated` + `react-native-svg`.

- `BoxContainer` — `frontend/components/layout/BoxContainer.tsx`
  - Layout wrapper (ScrollView) that provides the shared `boxContainer` spacing for pages such as the Theme showcase.

- `Input` — `frontend/components/Input.tsx`
  - Flexible input component supporting multiple types (text, email, password, number). Styled using theme values with consistent spacing, colors, and shadows. Supports label and error states.

- Barrel exports: `frontend/components/index.ts` exports the public components (e.g. `AppText`, `Box`, `BoxContainer`, `Checkbox`, `ProgressIcon`, `Input`). Use these for cleaner imports across the app.Maintenance
----------

1. When adding a new component, add a short entry above and include:
   - Purpose / one-line description
   - Any notable cross-platform differences (web vs native)
   - The file path

2. When updating a component, update this file with the change summary and date.

3. Keep `components/index.ts` in sync so imports across the app can use `import { Box } from './components'`.
