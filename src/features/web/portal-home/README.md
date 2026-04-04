# Portal Home Landing (Web Root `/`)

This folder contains the website root landing used by `src/app/page.tsx`.

## Structure

- `portal-home-view.tsx`: server-rendered shell that injects fixture HTML/CSS, rewrites content labels for BugLogin, and renders the original layout wrappers.
- `portal-home-runtime.tsx`: client-side runtime for theme sync (`data-theme`).
- `fixtures/source-content.html`: extracted full landing main content markup.
- `fixtures/source-inline-styles.html`: extracted inline styled-components styles from linear.app.
- `fixtures/source-css-urls.json`: local stylesheet URLs (`/css/*.css`) generated from linear.app homepage.

## Theme behavior

- Theme switch button is handled by shared portal header component.
- The clone root uses `data-theme` (`dark`/`light`) and updates from app theme class (`next-themes`).
- If no explicit class exists, it falls back to `prefers-color-scheme`.

## Maintenance

Use:

`pnpm sync:portal-home`

This updates all fixture files from `https://linear.app/` and downloads required CSS files to `public/css/`.
