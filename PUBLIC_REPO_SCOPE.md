# Public Release-Only Scope

This repository is intentionally limited to desktop app release packaging.

Included scope:
- Tauri desktop source (`src-tauri/`)
- Desktop frontend/build source needed by Tauri packaging (`src/`, `public/`, configs, scripts)
- Release workflow (`.github/workflows/desktop-release-public.yml`)

Excluded by design:
- Private operations data
- Internal API/backend services
- Non-release internal workflows/docs
