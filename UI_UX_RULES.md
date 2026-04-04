# BugLogin UI/UX & Coding Guidelines for AI Agents (Antigravity & Codex)

This document contains strict architectural rules, UI/UX guidelines, and coding standards specifically tailored for AI agents working on the frontend (Next.js/React/Tailwind) of the **BugLogin** application.

## 1. Core Technology Stack
- **Framework**: Next.js (App Router, `src/app`) + React 19.
- **Backend Bridge**: Tauri 2 (Rust). Communicate using `@tauri-apps/api/core` (`invoke`).
- **Styling**: Tailwind CSS **v4** + CSS variables (OKLCH color space).
- **Component Library**: Radix UI primitives wrapped by **Shadcn UI**.

---

## 2. Theming & Styling (Strict Rules)
- **NO HARDCODED COLORS**: Never use arbitrary colors (e.g., `text-red-500`, `#333`, `bg-gray-100`). The UI uses a strict `oklch` variable system defined in `src/styles/globals.css`.
- **Allowed Color Classes**: 
  - Backgrounds: `bg-background`, `bg-card`, `bg-popover`, `bg-muted`
  - Text: `text-foreground`, `text-muted-foreground`, `text-primary`, `text-destructive`
  - Borders/Rings: `border-border`, `ring-ring`
  - Brand/Action: `bg-primary text-primary-foreground`, `bg-secondary text-secondary-foreground`, `bg-destructive text-destructive-foreground`
- **Dark Mode**: Automatically handled via the `dark` class applied to the root element. If you stick to the CSS variables above, you don't need `dark:bg-black` logic.

---

## 3. UI Components & Layout Architecture
- **Reuse Shadcn Primitives**: Always look inside `src/components/ui/` first before building a component from scratch. (e.g., use `<Button>`, `<Input>`, `<Dialog>`, `<Select>`).
- **Layout Model**: 
  - The application body is technically an `overflow-hidden` fixed-window container (`layout.tsx`).
  - For lists or content that exceeds viewport height, use the `<ScrollArea>` component instead of allowing the whole page to scroll.
- **Modals over Pages**: BugLogin heavily utilizes dialogs for actions (e.g., `CreateProfileDialog`, `SettingsDialog`) rather than routing to new pages. Follow this pattern for new features.
- **Micro-Animations**: Use `tw-animate-css` or `motion` (Framer Motion) for subtle entrance/exit state animations to maintain a premium feel.

---

## 4. State Management & Tauri Integration
- **Abstracting Logic (Hooks)**: Complex state and Tauri event listeners must be mapped to custom hooks (e.g., `useProfileEvents`, `useProxyEvents`). Keep UI components clean.
- **Tauri Invocations**: 
  - When calling Rust backend points with `await invoke("command_name")`, *always* wrap the call in a `try...catch` block.
  - Never let an unhandled rejection crash the UI.

---

## 5. Feedback & Interactions
- **Toasts (Sonner)**: Never use native `alert()` or `console.error` exclusively. 
  - Use the custom wrappers in `src/lib/toast-utils.ts`.
  - Import and use `showSuccessToast(message)`, `showErrorToast(message)`, or `showSyncProgressToast()`.
- **Loading States**: All async actions (like buttons submitting forms or invoking Tauri commands) must have clear `isLoading` states (disabling the button, showing a spinner/loader).

---

## 6. Internationalization (i18n)
- BugLogin supports multiple languages.
- **Rule**: Any human-readable text you add to the UI *must* be translated.
- Use `const { t } = useTranslation()` from `react-i18next`.
- Example: Use `{t("profile.delete_confirm")}` instead of `"Are you sure you want to delete?"`.
- Update the English (`en.json`) and other translation files when adding new keys.

---

## 7. Icons
- Standardize on using `lucide-react` or `react-icons` for iconography.
- Ensure icons have appropriate sizing (e.g., `w-4 h-4`) and matching text colors (`text-current` or `text-muted-foreground`).

---

## 8. Development Workflow Checklist
Before finishing any task, run the following sequence to ensure zero regressions:
```bash
pnpm format && pnpm lint && pnpm test
```
*(As explicitly noted in `AGENTS.md` and `CLAUDE.md`)*
