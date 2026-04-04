# Instructions for AI Agents (Antigravity & Codex)

## 1. General Coding & Testing
- Do not run full-project checks by default. Prefer minimal verification first (typecheck, targeted test, or no check for docs-only edits).
- Run `pnpm format && pnpm lint && pnpm test` only when truly needed: high-risk changes, pre-merge/release, or when explicitly requested.
- If `pnpm tauri dev` is running, avoid heavy commands that may trigger long recompilation or interrupt the active dev flow unless explicitly approved.
- Don't leave comments that don't add value.
- Do not duplicate code unless you have a very good reason to do so. It is important that the same logic is not duplicated multiple times.
- If there is a global singleton of a struct (in Rust), only use it inside a method while properly initializing it, unless explicitly specified otherwise in the request.

## 2. UI / UX & Theming Rules
- **NO HARDCODED COLORS**: If you are modifying the UI, do not add random colors (e.g., `text-red-500`, `#333`, `bg-gray-100`). The UI uses a strictly defined `oklch` CSS variables system.
- **Allowed Colors**: `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `text-primary`, `border-border`, etc. All these variables auto-adapt to dark mode.
- **Dark Mode**: No `dark:bg-black` needed. Stick to the variables and it works automatically via the `.dark` class on root.
- **Layout Model**: The application is an `overflow-hidden` fixed window. For scrollable content, always use the `<ScrollArea>` component from Shadcn, do not let the whole page scroll.
- **Modals over Routing**: BugLogin heavily utilizes dialogs (Modals) for actions (e.g., settings, profile creation). Do not create new pages/routes for forms unless required.
- **Desktop Width Contract (Required)**:
  - For page surfaces rendered inside `WorkspacePageShell`, do not use `max-w-none` by default.
  - Use centered bounded content width unless a true data-dense screen requires full width. Preferred default: `mx-auto w-full max-w-[1120px]`.
  - Search bars, filter bars, and toolbars must be content-width aware (avoid stretching every control to full row width without UX reason).
- **No Duplicate Page Titles (Required)**:
  - If `WorkspacePageShell` already provides `title`/`description`, do not render a second page title/description inside the child page component.
  - Dialog mode may have `DialogTitle`; page mode must not duplicate the same heading block.
- **Surface Density Rules (Required)**:
  - Avoid nested `rounded-md border` wrappers without information hierarchy value.
  - Prefer one primary surface per section, with separators/spacing before adding additional boxes/cards.
  - Do not wrap every subsection in a card by default; justify each bordered container by behavior (selection, grouped controls, warning state, or independent scroll region).
- **Typography Contract (Required)**:
  - Keep body/table text consistent (`text-sm` baseline) and use heavier weights only for real emphasis.
  - Avoid mixing `text-xs`/`text-sm`/`text-base` in the same semantic level.
  - Use existing utility tokens in `globals.css` (`type-ui-sm`, `type-section`, etc.) where appropriate instead of ad-hoc one-off sizes.
- **Desktop UI Anti-patterns (Must Fix if touched)**:
  - Full-width search/input bars that become visually overlong on wide screens.
  - Full-width tables when the data does not require it.
  - Repeated title blocks and repeated action bars in one page.
  - Visual noise from redundant icons/dots/outlined chips for already-clear hierarchy.

## 3. UI Components Architecture
- **Reuse Shadcn Primitives**: Always look inside `src/components/ui/` first before building a tag from scratch. Use the existing `<Button>`, `<Input>`, `<Select>`, `<Dialog>`, etc.
- **Micro-Animations**: Use `tw-animate-css` or `motion` (Framer) for state animations to maintain a premium feel.
- **Icons**: Standardize on using `lucide-react` or `react-icons`. Make them small and neutral (e.g. `w-4 h-4 text-muted-foreground`).
- **Shadcn Scope Clarification**: Shadcn provides component primitives, not complete page-layout decisions. You must still enforce BugLogin page-level layout contracts (width, heading structure, surface density, typography consistency).

## 4. State Management & Tauri Integration
- **Abstract Logic**: Complex state and Tauri event listeners must use custom hooks (e.g., `useProfileEvents`).
- **Tauri Invocations**: When invoking Rust backend with `await invoke("command_name")`, *always* wrap the call in a `try...catch` block. Never let an unhandled rejection crash the UI.
- **Feedback & Interactions (Toasts)**: Never use native `alert()` or `console.error` to communicate with the user.
  - Import and use `showSuccessToast(message)` or `showErrorToast(message)` from `src/lib/toast-utils.ts`.
- **Loading States**: All async interactions (submitting forms, invoking Tauri commands) must have clear loading states (disabling buttons, showing spinners/loaders).

## 5. Internationalization (i18n)
- BugLogin supports multiple languages.
- **CRITICAL RULE**: Anytime you make changes that affect copy or add new text, it has to be reflected in all translation files.
- Use `const { t } = useTranslation()` from `react-i18next`. Example: Use `{t("profile.delete_confirm")}` instead of hardcoded strings.

## 6. Runtime Isolation (Absolute)
- **Never share `node_modules` between Windows PowerShell and WSL/Linux** for this repository.
- **Windows-first project workflow**: if this repo was installed in Windows, execute `pnpm dev`, `pnpm tauri ...`, `pnpm format`, `pnpm lint`, and `pnpm test` in Windows (PowerShell/CMD), not WSL.
- If you run `pnpm install` in Windows, keep running Tauri commands in Windows for that install.
- If you run `pnpm install` in WSL/Linux, keep running Tauri commands in WSL/Linux for that install.
- Before running `pnpm dev`, `pnpm tauri ...`, `pnpm format`, `pnpm lint`, or `pnpm test`, the runtime guard script must pass:
  - `scripts/guard-node-modules-runtime.mjs`
- If guard fails, reinstall dependencies in the same runtime where you want to execute:
  - Windows: `Remove-Item -Recurse -Force node_modules && pnpm config set shell-emulator true && pnpm install`
  - WSL/Linux: `rm -rf node_modules && pnpm install`

## 7. OpenSpec / Superpowers / Beads
- Use OpenSpec for scoped non-trivial changes: create a proposal under `openspec/changes/<change-id>/` before implementation, then apply and archive when complete.
- Use Superpowers skills when available and relevant before implementation steps; follow project/user instructions first when conflicts exist.
- Track work with beads under `docs/workflow/beads/` (small, independent execution items with status) for visibility when tasks are split or long-running.

## 8. Upstream BugLoginBrowser Intake
- Upstream source for comparison/sync review: `https://github.com/zhom/bugloginbrowser`.
- Never sync upstream blindly. Every upstream commit must be evaluated and logged before local adoption.
- Canonical intake folder: `docs/workflow/references/upstream-bugloginbrowser/`.
- Required artifacts for intake:
  - `docs/workflow/references/upstream-bugloginbrowser/upstream-intake-log.md`
  - `docs/workflow/references/upstream-bugloginbrowser/commit-review-template.md`
- Decision states per upstream commit: `adopt | adapt | defer | skip`.
- If BugLogin has diverged heavily in touched modules, prefer `adapt` over direct port/cherry-pick.

## 9. Fork Browser Contract (Bugium / Bugox)
- Purpose of fork is **custom browser runtime**, not only aliasing names in BugLogin UI.
- Release is considered done only when published artifacts are built from fork sources that include BugLogin-specific customizations (branding/icon behavior/runtime identity rules), not plain mirrored upstream binaries.
- Mirroring upstream releases is allowed only as temporary fallback for service continuity; it must be explicitly labeled as fallback.
- Default managed browser slugs are canonical: `bugium`, `bugox`. Legacy keys (`wayfern`, `camoufox`) are compatibility inputs only.
- Any browser update workflow must preserve this order of priority:
  1. fork-custom artifact,
  2. verified previous stable fork artifact,
  3. temporary upstream mirror fallback (explicitly marked).
