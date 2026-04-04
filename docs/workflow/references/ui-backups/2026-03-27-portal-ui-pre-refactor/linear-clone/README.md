# Linear Clone Landing (Web Root `/`)

This folder contains the website root landing clone used by `src/app/page.tsx`.

## Structure

- `linear-source-view.tsx`: server-rendered shell that injects fixture HTML/CSS, rewrites header links/labels for BugLogin, renders the original `Layout_container` + `main` wrappers, and handles theme switch in header.
- `fixtures/linear-header.html`: extracted Linear header markup.
- `fixtures/linear-content.html`: extracted full landing main content markup.
- `fixtures/linear-inline-styles.html`: extracted inline styled-components styles from linear.app.
- `fixtures/linear-css-urls.json`: extracted stylesheet URLs from linear.app homepage.

## Theme behavior

- Theme switch button is embedded directly in header nav.
- The clone root uses `data-theme` (`dark`/`light`) and updates from app theme class (`next-themes`).
- If no explicit class exists, it falls back to `prefers-color-scheme`.

## Maintenance

Use:

`pnpm sync:linear-clone`

This updates all fixture files from `https://linear.app/` automatically.
