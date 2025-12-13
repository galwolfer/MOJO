**Overview**

- **Purpose:** Quick reference for developing and running the frontend in this repository.
- **Location:** This file lives at `frontend/frontend.instructions.md` and documents common tasks.

**Setup**

- **Switch to frontend folder:** Open a terminal in the `frontend` directory.
- **Install dependencies (first time):** Run `npm install` in `frontend`.
- **Start the app:** Run `npx expo start` from the `frontend` folder to launch the Metro bundler and Expo dev tools.
- **Environment check:** Ensure Node.js and Expo CLI are available. On Windows PowerShell use `node -v` and `npx expo --version`.

**Project Structure (quick map)**

- **Entry & config:** `App.tsx`, `index.ts`, `package.json`, `tsconfig.json`, `babel.config.js`.
- **Android native bits:** `android/` (only for native builds; generally managed by Expo).
- **Core UI & components:** `components/` — organized into `common/` (general reusable), `special/` (app-specific), `icons/`, `inputs/`, `layout/`.
- **Screens & navigation:** `screens/` for screen components, `navigation/` for navigation setup.
- **Logic & utilities:** `hooks/` for custom React hooks, `services/` for API calls, `utils/` for helper functions, `constants/` for app constants.
- **Assets:** `assets/` contains fonts, images, and other static files used by the app.

**Using Premade Themes & Styles**

- **Theme source:** The primary theme file is `theme.ts` in the project root (or `frontend/theme.ts`).
- **How to use:** Import the theme where needed, e.g. `import { COLORS, SPACING, TYPOGRAPHY, FONTS, SHADOWS, COMPONENT_STYLES } from './theme'`.
- **Colors & tokens:** Always use `COLORS` for colors (e.g., `COLORS.primary1`), `SPACING` for margins/padding (e.g., `SPACING.md`), `FONT_SIZES` for text sizes, and `ICON_SIZES` for icon dimensions. Avoid hard-coded values.
- **Typography:** Use `TYPOGRAPHY` presets like `title`, `bodyText`, `notes` for consistent text styling. For custom fonts, reference `FONTS` (e.g., `FONTS.fredokaBold`).
- **Shadows & styles:** Apply `SHADOWS.card` for consistent shadows, and `COMPONENT_STYLES` for reusable component styles like `inputWrapper` or `listContainer`.
- **Utilities:** Use `getPalettePair()` or `paletteIndexFromKey()` for dynamic color pairing based on keys.
- **Adding styles:** Always use theme tokens inside `StyleSheet.create` or styled components to keep design consistent. Example: `color: COLORS.primary1, fontSize: FONT_SIZES.md, margin: SPACING.lg`.

**Using Premade Components**

- **Find components:** Look in `components/` subfolders: `common/` for general reusable components, `special/` for app-specific ones, `inputs/`, `layout/`, `icons/`.
- **Examples:** `components/common/AppText.tsx`, `components/inputs/Input.tsx`, `components/layout/Box.tsx`, `components/special/PriorityList.tsx`, `components/icons/Checkbox.tsx`.
- **Props & patterns:** Inspect component prop types in their files (or `index.ts`) to learn usage patterns. Prefer composition over duplication.
- **Reusing icons:** Import icons from `components/icons/icons.tsx` (or named exports) rather than re-copying SVGs.

**Running & Development Workflow**

- **Start dev server:** `cd frontend; npx expo start`.
- **Open on device/emulator:** Use the Expo devtools (browser) to open on a connected device, Android emulator, or iOS simulator (if available).
- **Hot reload:** Expo provides fast refresh — edit and save to see changes immediately.
- **Debugging:** Use console logs or React Native Debugger / Flipper for advanced debugging.

**Adding a New Component (recommended steps)**

- **1 — Create folder/file:** Add a new file under `components/` (or a subfolder) that matches the component purpose.
- **2 — Keep it small:** Make components single-responsibility. Break complex parts into smaller subcomponents.
- **3 — Use theme tokens:** Reference `theme.ts` values extensively for colors (`COLORS`), spacing (`SPACING`), typography (`TYPOGRAPHY`), shadows (`SHADOWS`), and component styles (`COMPONENT_STYLES`).
- **4 — Export from index:** If reusable, add an export to `components/index.ts` so other parts of the app can import from `components`.
- **5 — Document props:** Add a short comment or JSDoc for the main props to make usage clear.

**Assets & Icons**

- **Fonts:** Place custom fonts in `assets/fonts/` and link them if necessary (Expo supports auto linking for managed workflow).
- **SVGs:** Inline SVGs often live in `components/icons/` or `imports/`; use existing icon components where possible.

**Common Troubleshooting**

- **Metro caching issues:** If you see stale builds, run `npx expo start -c` to clear the cache.
- **Dependency problems:** Delete `node_modules` and `package-lock.json`/`yarn.lock`, then reinstall.
- **Platform-specific issues:** Check `android/` or native manifests only if doing a native build; Expo abstracts these for most dev tasks.

**Useful Commands**

- `cd frontend` : move into the frontend workspace.
- `npm install` or `yarn` : install dependencies.
- `npx expo start` : start development server and Expo devtools.
- `npx expo start -c` : clear Metro cache and start.

**Tips & Best Practices**

- **Use the theme everywhere:** Import and use `COLORS`, `SPACING`, `TYPOGRAPHY`, `SHADOWS`, and `COMPONENT_STYLES` for all styling to drastically reduce CSS drift and ensure consistency.
- **Centralize exports:** Re-export common components from `components/index.ts` to make imports consistent.
- **Small PRs:** Keep UI changes small and focused — easier to review and test.

**Coding Standards**

- **File Structure:** Organize each component file in this order: 1) Helper functions/utilities, 2) Main component, 3) Styles. This improves readability and maintainability.
- **Function Notes:** Add JSDoc comments for every function, describing its purpose, parameters, and return value. Example:
  ```typescript
  /**
   * Calculates the total price including tax.
   * @param price - The base price.
   * @param taxRate - The tax rate as a decimal.
   * @returns The total price.
   */
  function calculateTotalPrice(price: number, taxRate: number): number {
    return price * (1 + taxRate);
  }
  ```
- **Clearer Names:** Use descriptive, camelCase names for variables, functions, and components. Avoid abbreviations; prefer `userInputValue` over `uiv`, `handleSubmitForm` over `submit`.

If you'd like, I can also add short usage examples for a few core components (copy-paste examples) or create quick unit/storybook stories for components.
