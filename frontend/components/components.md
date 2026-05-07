# Components

This file documents the UI components in `frontend/components`.
Update this file whenever you add, remove, or change a component.

## Conventions

- File layout: **helpers & types first → component function/JSX → styles (`StyleSheet.create`)**.
- Add a short JSDoc block for each exported component (purpose + props + usage example).
- Prefer theme tokens (`COLORS`, `SPACING`, `TYPOGRAPHY`) and `StyleProp` for style props.

### Documentation style (follow `Input.tsx`)
- Use a short header describing the component's purpose, behavior, and usage.
- Include an `Usage` example and note common patterns (e.g., entrance animations, async upload, error states).
- If a component is duplicated across `screens/*/components` and `components/`, prefer a single canonical implementation in `components/` and re-export from the screen folder so code consumers can import from either place without duplication.

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

- `ScrollableContent` — `frontend/components/layout/ScrollableContent.tsx`
  - ScrollView wrapper that respects floating header/nav heights and handles keyboard-aware scrolling. Provides a ref API for programmatic scrolling and supports automatic restore of scroll position.

- `MainLayout` — `frontend/components/layout/MainLayout.tsx`
  - App-level composition of Header, NavBar and content area. Measures header and navbar heights, adapts layout for keyboard, and routes to the active screen (e.g., Chat, Calendar, UserProfile).

- `Input` — `frontend/components/inputs/Input.tsx`
  - Flexible input component supporting multiple types (text, email, password, number). Styled using theme values with consistent spacing, colors, and shadows. Supports label and error states. When `options` prop is provided, acts as a dropdown selector. Use `multiSelect` prop to enable multiple selections with checkboxes; otherwise, it's single select without checkboxes. The dropdown is rendered in a Modal to "fly over" other content, and clicking outside closes it.

- `CalendarPicker` — `frontend/components/inputs/CalendarPicker.tsx`
   - Inline month grid date picker used across task creation, task editing, calendar views, and scheduling. Uses the active theme for the surface, labels, and date text so dark mode remains readable.

- `AppButton` — `frontend/components/common/AppButton.tsx`
   - Reusable button component that supports an icon (choose any key from `frontend/components/icons/icons.tsx`) placed on the left or right via the `iconPosition` prop. Two visual modes are available: `filled` (solid background) and `light` (transparent background with border). Color can be selected from `COLORS` in `frontend/theme.ts` by passing the color key (e.g. `primary1`) or a CSS color string. Uses `SHADOWS.card` for consistent surface shadowing across platforms.

- `AnimatedButtonsContainer.tsx` — `frontend/components/common/AnimatedButtonsContainer.tsx`
   - Reusable animated wrapper for groups of buttons or action elements. Supports optional vertical stacking, container entrance animation (fade + translateY), and per-child staggered entrance. Useful for onboarding and chat-bubble action groups where buttons should appear sequentially.
   - Props: `entranceEnabled`, `vertical`, `staggerChildren`, `staggerDelay`, `containerDelay`, `gap`, `paddingTop`, `paddingBottom`.

- `Widget.tsx` — `frontend/components/special/Widget.tsx`
   - A compact surfaced container (uses `COLORS.white3`) with a configurable entrance animation (fade + translateY). Use to group small forms and controls within chat bubbles or card surfaces.
   - Props: `entranceEnabled?: boolean`, `entranceDelay?: number`, `entranceDuration?: number`, `style?: StyleProp<ViewStyle>`.
   - Example:
```tsx
<Widget entranceEnabled={typingDone} entranceDelay={100} entranceDuration={200}>
  <Input label="Email" placeholder="you@example.com" />
</Widget>
```

- `ConicGradientBubble.tsx` — `frontend/components/special/ConicGradientBubble.tsx`
   - Animated gradient bubble component using Skia for visual effects.

- `PriorityList.tsx` — `frontend/components/special/PriorityList.tsx`
   - Draggable priority list component for reordering items.

- `TextBouble.tsx` — `frontend/screens/chat/components/TextBouble.tsx`
   - High-performance chat text bubble component that supports typewriter animations and non-text fade-ins. Use for assistant and user message presentation.

- `ChatMessageBubble.tsx` — `frontend/screens/chat/components/ChatMessageBubble.tsx`
   - Renders a single chat message with user/assistant styles, error heuristics and retry hooks. Uses `TextBouble` for animated message rendering.

- `TimelineItem.tsx` — `frontend/screens/chat/components/TimelineItem.tsx`
   - Renders either a `SessionDivider` (session boundary) or a `ChatMessageBubble` entry. Optimized with `React.memo` and a custom `areEqual` comparator for long lists.

- `SessionDivider.tsx` — `frontend/screens/chat/components/SessionDivider.tsx`
   - Small centered label used to separate chat sessions in the timeline.

- `ChatScreen` — `frontend/screens/Chat.tsx`
   - Main chat screen responsible for wiring up sessions, messages, and the message composer. Handles keyboard-aware scrolling, restore behavior and integrates timeline rendering utilities.

- Barrel exports: `frontend/components/index.ts` exports the public components (e.g. `AppText`, `Box`, `BoxContainer`, `Checkbox`, `ProgressIcon`, `Input`, `ConicGradientBubble`, `PriorityList`, `TextBouble`). Use these for cleaner imports across the app.

## Hooks

- `useKeyboard` — `frontend/hooks/useKeyboard.ts`
  - Tracks keyboard visibility and height across platforms. Use to adjust content and input positioning when the keyboard appears.
  - Usage: `const { visible, height } = useKeyboard();`

- `useContentInsets` — `frontend/hooks/useContentInsets.ts`
  - Computes content insets that respect the floating header and navbar and provides a `bottomWithKeyboard` value when the keyboard appears.
  - Usage: `const { top, bottom, bottomWithKeyboard } = useContentInsets();`

- `useChatSessions` — `frontend/hooks/useChatSessions.ts`
  - Loads, merges and caches chat sessions; exposes `sessions`, `loadMoreSessions`, and `updateSession` helpers.

- `useChatMessages` — `frontend/hooks/useChatMessages.ts`
  - Manages message send/retry lifecycle with optimistic UI updates and failure handling.

## Examples

### AppButton
```tsx
<AppButton title="Save" onPress={save} icon="check" mode="filled" color="primary6" />
```

### AnimatedButtonsContainer
```tsx
<AnimatedButtonsContainer entranceEnabled={typingDone} vertical staggerChildren staggerDelay={120}>
  <AppButton title="Primary action" width="100%" color="primary6" />
  <AppButton title="Secondary" mode="light" width="100%" />
</AnimatedButtonsContainer>
```


### Input
```tsx
<Input label="Email" placeholder="you@example.com" type="email" />
```

### AppText
```tsx
<AppText variant="title2">Welcome back</AppText>
```

## Maintenance
----------

- `Icons` — `frontend/components/icons/icons.tsx`
   - Central icon registry. Imports all SVGs from `components/icons/icons-lib` and exports a lookup `ICONS` map and `ICON_NAMES` array.
   - Usage: import an icon component and render with `size` and `color` props.
      - Example: `import { ICONS } from './components/icons/icons';` then `const Icon = ICONS.burger; <Icon size={ICON_SIZES.sm} color={COLORS.primary1} />` or `const Icon = ICONS['burger']; <Icon size={ICON_SIZES.sm} color={COLORS.primary1} />`.
   - Cross-platform behavior:
      - Native (iOS/Android): uses `react-native-svg` components via the svg transformer when available, and forwards `size` → width/height and `color` → fill/stroke.
      - Web: uses generated inline SVG data URIs (see `scripts/generate-svg-data-uris.js`) and injects the requested `color` into the SVG so theming works.
   - Adding new icons:
      1. Put the `.svg` file in `components/icons/icons-lib/`.
      2. Run `node scripts/generate-svg-data-uris.js` to update `svg-data-uris.ts` for web fallback.
      3. Add the icon to the `ICONS` map in `icons.tsx` (follow existing naming conventions).

## User Profile Components

- `StatBadge` — `frontend/screens/user/components/StatBadge.tsx`
   - Displays a single stat with an icon, value, and label. Used in the user profile for showing tasks, points, and streak.
   - Props: `icon` (React node), `value` (number/string), `label` (string), `color` (optional, defaults to primary1).

- `ProgressGraph` — `frontend/screens/user/components/ProgressGraph.tsx`
   - Displays a simple line graph showing user progress over time using react-native-svg.
   - Props: `data` (array of numbers), `width`, `height`, `color` (optional).

- `FriendListItem` — `frontend/screens/user/components/FriendListItem.tsx`
   - Displays a friend in the friends list with avatar, name, and mini stats.
   - Props: `name`, `avatar`, `stats` (tasks/streak/points), `isOnline`.

1. When adding a new component, add a short entry above and include:
   - Purpose / one-line description
   - Any notable cross-platform differences (web vs native)
   - The file path

2. When updating a component, update this file with the change summary and date. Example:
   - `2026-01-11` — Added `AnimatedButtonsContainer` (`common`) and `Widget` (`special`); refactored auth steps to use `AnimatedButtonsContainer` and added Welcome screen stagger behavior.
   - `2026-01-15` — Added `UserProfileScreen` with `StatBadge`, `ProgressGraph`, and `FriendListItem` components for the new profile page design.
   - `2026-05-07` — Updated `CalendarPicker` and task form wrappers to use theme-aware dark-mode surfaces and readable date text in create/edit flows.

3. Keep `components/index.ts` in sync so imports across the app can use `import { Box } from './components'`.

