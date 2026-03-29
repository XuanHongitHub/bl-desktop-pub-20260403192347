# Notion VI Landing Clone Design

**Date:** 2026-03-27

## Goal
Create a standalone HTML/CSS/JS clone of the Vietnamese Notion homepage shown in the provided screenshot, with high visual fidelity to the live layout, spacing, hierarchy, and interaction feel.

## Scope
- New standalone files only under `mockups/notion-vi-clone/`
- No integration into the Next/Tauri app
- Desktop-first layout matching the screenshot composition
- Responsive fallback for smaller widths
- Reuse remote Notion assets for hero/product visuals where precision matters

## Design
- Recreate the page as real HTML sections rather than flattened cards or a single image.
- Match the Notion visual language: narrow content width, quiet spacing, rounded panels, restrained shadows, and editorial typography.
- Use a layered hero with a dark blue backdrop, floating annotation chips, and an embedded product frame.
- Use an interactive section for the Notion 3.0 carousel so the page feels closer to the original UI/UX.
- Use the real Vietnamese strings and live asset URLs from notion.com/vi where available.
- Approximate the download-app cards with handcrafted HTML surfaces where the live page does not expose asset URLs directly.

## Verification
- Serve the mockup with a local static server.
- Confirm the page returns HTTP 200.
- Open the generated page in the Windows browser immediately after creation.
