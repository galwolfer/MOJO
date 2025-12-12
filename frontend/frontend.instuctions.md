**Overview**

- **Purpose:** Quick reference for developing and running the frontend in this repository.
- **Location:** This file lives at `frontend/frontend.instuctions.md` and documents common tasks.

**Setup**

- **Switch to frontend folder:** Open a terminal in the `frontend` directory.
- **Install dependencies (first time):** Run `npm install` or `yarn` in `frontend`.
- **Start the app:** Run `npx expo start` from the `frontend` folder to launch the Metro bundler and Expo dev tools.
- **Environment check:** Ensure Node.js and Expo CLI are available. On Windows PowerShell use `node -v` and `npx expo --version`.

**Project Structure (quick map)**

- **Entry & config:** `App.tsx`, `index.ts`, `package.json`, `tsconfig.json`, `babel.config.js`.
- **Android native bits:** `android/` (only for native builds; generally managed by Expo).
- **Core UI & components:** `components/` — main reusable UI pieces live here.
- **Inputs & layout:** `components/inputs/` and `components/layout/` contain common form controls and layout helpers.
- **Icons:** `components/icons/` contains SVG/icon components like `Checkbox.tsx`, `icons.tsx`.
- **Assets:** `assets/` contains fonts, images, and other static files used by the app.

**Using Premade Themes & Styles**

- **Theme source:** The primary theme file is `theme.ts` in the project root (or `frontend/theme.ts`).
- **How to use:** Import the theme where needed, e.g. `import theme from './theme'` or via the app's context/provider if one exists.
- **Colors & tokens:** Prefer using `theme.colors`, `theme.space`, and other tokens instead of hard-coded values to keep UI consistent.
- **Adding styles:** Use the theme tokens inside `StyleSheet.create` or styled components to keep design consistent across components.

**Using Premade Components**

- **Find components:** Look in `components/` and subfolders. Reusable pieces (inputs, icons, layout) are organized by purpose.
- **Examples:** `components/inputs/Input.tsx`, `components/inputs/InputField.tsx`, `components/icons/Checkbox.tsx`.
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
- **3 — Use theme tokens:** Reference `theme.ts` values for colors, spacing, and typography.
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

- **Use the theme everywhere:** It drastically reduces CSS drift and makes theming easier.
- **Centralize exports:** Re-export common components from `components/index.ts` to make imports consistent.
- **Small PRs:** Keep UI changes small and focused — easier to review and test.

If you'd like, I can also add short usage examples for a few core components (copy-paste examples) or create quick unit/storybook stories for components.

