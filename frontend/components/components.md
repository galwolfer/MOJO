# Components

This file documents the UI components in `frontend/components`.
Update this file whenever you add, remove, or change a component.

# Components

This file documents the UI components in `frontend/components`.
Update this file whenever you add, remove, or change a component.

- `AppText.tsx` — `frontend/components/common/AppText.tsx`
   - Text wrapper that applies the app's `TYPOGRAPHY` presets. Use `variant` to pick a preset (e.g. `title`, `bodyText`, `notes`). Centralizes typography.

- `Box.tsx` — `frontend/components/layout/Box.tsx`
   - A surfaced card with a styled title bar and content. Use to group UI into distinct sections. Title uses `title3` typography.

- `Checkbox` (web) — `frontend/components/icons/Checkbox.tsx`
   - Web checkbox (animated) using `motion/react`. Mirrors native checkbox behavior.

- `Checkbox.native.tsx` (native) — `frontend/components/icons/Checkbox.native.tsx`
   - Native checkbox for mobile using `Animated` + `react-native-svg`.

- `ProgressIcon` (web) — `frontend/components/icons/ProgressIcon.tsx`
   - Web progress/status icon with SVG animation; morphs into a check at 100%.

- `ProgressIcon.native.tsx` (native) — `frontend/components/icons/ProgressIcon.native.tsx`
   - Native mobile version of the progress icon using `Animated` + `react-native-svg`.

- `BoxContainer` — `frontend/components/layout/BoxContainer.tsx`
  - Layout wrapper (ScrollView) that provides the shared `boxContainer` spacing for pages such as the Theme showcase.

- `Input` — `frontend/components/inputs/Input.tsx`
  - Flexible input component supporting multiple types (text, email, password, number). Styled using theme values with consistent spacing, colors, and shadows. Supports label and error states. When `options` prop is provided, acts as a dropdown selector. Use `multiSelect` prop to enable multiple selections with checkboxes; otherwise, it's single select without checkboxes. The dropdown is rendered in a Modal to "fly over" other content, and clicking outside closes it.

- `ConicGradientBubble.tsx` — `frontend/components/special/ConicGradientBubble.tsx`
   - Animated gradient bubble component using Skia for visual effects.

- `PriorityList.tsx` — `frontend/components/special/PriorityList.tsx`
   - Draggable priority list component for reordering items.

- `TextBouble.tsx` — `frontend/components/common/TextBouble.tsx`
   - Text bubble component for displaying text in a styled bubble.

- Barrel exports: `frontend/components/index.ts` exports the public components (e.g. `AppText`, `Box`, `BoxContainer`, `Checkbox`, `ProgressIcon`, `Input`, `ConicGradientBubble`, `PriorityList`, `TextBouble`). Use these for cleaner imports across the app.Maintenance
----------

- `Icons` — `frontend/components/icons/icons.tsx`
   - Central icon registry. Imports all SVGs from `components/icons/icons-lib` and exports a lookup `ICONS` map and `ICON_NAMES` array.
   - Usage: import an icon component and render with `size` and `color` props.
      - Example: `import { ICONS } from './components/icons/icons';` then `const Icon = ICONS.burger; <Icon size={24} color={COLORS.primary1} />` or `const Icon = ICONS['burger']; <Icon size={24} color={COLORS.primary1} />`.
   - Cross-platform behavior:
      - Native (iOS/Android): uses `react-native-svg` components via the svg transformer when available, and forwards `size` → width/height and `color` → fill/stroke.
      - Web: uses generated inline SVG data URIs (see `scripts/generate-svg-data-uris.js`) and injects the requested `color` into the SVG so theming works.
   - Adding new icons:
      1. Put the `.svg` file in `components/icons/icons-lib/`.
      2. Run `node scripts/generate-svg-data-uris.js` to update `svg-data-uris.ts` for web fallback.
      3. Add the icon to the `ICONS` map in `icons.tsx` (follow existing naming conventions).

1. When adding a new component, add a short entry above and include:
   - Purpose / one-line description
   - Any notable cross-platform differences (web vs native)
   - The file path

2. When updating a component, update this file with the change summary and date.

3. Keep `components/index.ts` in sync so imports across the app can use `import { Box } from './components'`.
