**Overview**

- **Purpose:** Quick reference for developing and running the frontend in this repository.
- **Location:** This file lives at `frontend/frontend.instructions.md` and documents common tasks and coding standards for the frontend.

**Setup**

- **Switch to frontend folder:** Open a terminal in the `frontend` directory.
- **Install dependencies (first time):** Run `npm install` in `frontend`.
- **Start the app:** Run `npx expo start` from the `frontend` folder to launch the Metro bundler and Expo dev tools.
- **Environment check:** Ensure Node.js and Expo CLI are available. On Windows PowerShell use `node -v` and `npx expo --version`.

**Project Structure (quick map)**

- **Entry & config:** `App.tsx`, `index.ts`, `package.json`, `tsconfig.json`, `babel.config.js`.
- **Core UI & components:** `components/` — organized into `common/`, `special/`, `icons/`, `inputs/`, `layout/`.
- **Screens & navigation:** `screens/` for screen components, `navigation/` for navigation setup.
- **Logic & utilities:** `hooks/` for custom React hooks, `services/` for API calls, `utils/` for helpers, `constants/` for tokens.
- **Assets:** `assets/` contains fonts, images, and other static files used by the app.

**Component Format & Documentation (new guidance)** 🔧

- **File order (required):** Every component file should follow this ordering: **1) helper functions & types, 2) main component/function (JSX), 3) styles (`StyleSheet.create`)**. This matches the "Function > HTML > CSS" format requested.
- **JSDoc required:** Add a short JSDoc block for each exported component and for helpers that are not obvious. Include parameter descriptions and a short usage example when useful.
- **Type-safety:** Prefer `StyleProp<ViewStyle>`/`StyleProp<TextStyle>` for `style` props and explicit `React.ComponentType<{ size?: number; color?: string }>` for icon props.
- **Central exports:** Add reusable component exports to `components/index.ts` (we keep the index up to date).
- **Remove dead code:** Remove unused helper functions and unused styles found during development. Run `npx tsc --noEmit --skipLibCheck` before committing to catch type issues.

**Using Theme & Tokens** 💡

- **Theme source:** `theme.ts` (root). Use tokens: `COLORS`, `SPACING`, `TYPOGRAPHY`, `SHADOWS`, `COMPONENT_STYLES`, `ICON_SIZES`, `FONT_SIZES`.
- **No hard-coded values:** Prefer theme tokens over raw numbers/strings. If a special value is needed, add a token to `theme.ts`.

**Key Components & Patterns (updated)** ✅

- App-level components that were documented/refactored in this pass:
  - `components/common/AppButton.tsx` — typed props, JSDoc, animation explained.
  - `components/common/AppText.tsx` — typed variant and improved types.
  - `components/common/Header.tsx` — tighter prop types, JSDoc.
  - `components/common/NavBar.tsx` — JSDoc and cleanup of unused imports.
  - `components/common/TextBouble.tsx` — typewriter explained and well-documented (complex, keep as-is).
  - `components/common/AnimatedButtonsContainer.tsx` — new reusable animated wrapper for button groups. Supports vertical stacking and per-child staggered entrance; ideal for onboarding and chat bubble action layouts.
  - `components/special/Widget.tsx` — surfaced widget container with entrance animation (fade + translateY). Documented usage and recommended for embedding form fields inside `TextBouble`.
  - `components/inputs/Input.tsx` — documented, simplified dropdown handling, web caret support explained.
  - `components/layout/Box.tsx` & `BoxContainer.tsx` — typed and better documented.
  - `components/special/PriorityList.tsx` — web drag-and-drop list (documented).

**Running & Development Workflow**

- **Start dev server:** `cd frontend; npx expo start`.
- **Clear cache:** `npx expo start -c`.
- **Type checks:** Run `npx tsc --noEmit --skipLibCheck` to verify types before PR.
- **Quick checks:** Use `npm run lint` if configured; otherwise rely on `tsc` and local testing.

**Adding a New Component (checklist)** 🟦

1. Create file under `components/<subfolder>`.
2. Add JSDoc for the component and exported helpers.
3. Follow the File order: helpers -> component -> styles.
4. Use theme tokens (`COLORS`, `SPACING`, `TYPOGRAPHY`, etc.).
5. Export the component from `components/index.ts` if reusable.
6. Add a small usage snippet to the top of the component file or update `components/components.md`.
7. Run `npx tsc --noEmit --skipLibCheck` and manual spot-check in the app.

**Cleaning up unused code** ⚠️

- During this cleanup pass we removed several unused styles and functions that were never referenced.
- Before removing code, search for usages (`grep`/IDE find). Prefer small, reversible PRs for removals.

**Assets & Icons**

- **Fonts:** Place fonts in `assets/fonts/`.
- **Icons:** Use `components/icons/icons.tsx` to avoid copying SVGs. Icon components should accept `size` and `color` props.

**Examples & Docs** ✨

- Core components now include short usage examples in their JSDoc (e.g., `AppButton`, `Input`, `Box`).
- A `components/components.md` exists for quick references — update it when adding or changing public component APIs.

**Common Troubleshooting**

- **Metro caching issues:** `npx expo start -c`.
- **Dependency problems:** Delete `node_modules` and lockfiles, reinstall.
- **Platform-specific issues:** Check native folders only when doing native builds.

**Useful Commands**

- `cd frontend`
- `npm install`
- `npx expo start`
- `npx expo start -c`
- `npx tsc --noEmit --skipLibCheck` (type check)

If you'd like, I can add short usage examples or create a `COMPONENTS-CHANGELOG.md` that lists files updated in this sweep. 