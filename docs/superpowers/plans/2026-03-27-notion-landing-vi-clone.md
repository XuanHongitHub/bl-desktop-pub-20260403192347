# Notion VI Landing Clone Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone HTML clone of the Vietnamese Notion homepage shown in the user-provided screenshot.

**Architecture:** Create a self-contained mockup under `mockups/notion-vi-clone/` using static HTML, a dedicated stylesheet, and a tiny JS file for carousel behavior. Keep all changes isolated from the app code and use live Notion assets where exact visual fidelity matters.

**Tech Stack:** HTML, CSS, vanilla JavaScript

---

### Task 1: Set up isolated mockup files

**Files:**
- Create: `mockups/notion-vi-clone/index.html`
- Create: `mockups/notion-vi-clone/styles.css`
- Create: `mockups/notion-vi-clone/script.js`

- [ ] Create a new standalone mockup directory.
- [ ] Add semantic page structure for header, hero, feature sections, ROI, social proof, download CTA, and footer.
- [ ] Add a dedicated stylesheet and script file.

### Task 2: Recreate the layout and visuals

**Files:**
- Modify: `mockups/notion-vi-clone/index.html`
- Modify: `mockups/notion-vi-clone/styles.css`
- Modify: `mockups/notion-vi-clone/script.js`

- [ ] Implement a desktop-first header and hero matching the Notion composition.
- [ ] Build the Notion 3.0 carousel section with switchable slide states.
- [ ] Build the stacked feature blocks and ROI section with real live assets.
- [ ] Build social proof, use cases, and download/footer sections.
- [ ] Add responsive behavior for tablet/mobile widths.

### Task 3: Verify and open the result

**Files:**
- Modify: `mockups/notion-vi-clone/index.html`
- Modify: `mockups/notion-vi-clone/styles.css`
- Modify: `mockups/notion-vi-clone/script.js`

- [ ] Serve the repository with `python3 -m http.server`.
- [ ] Confirm the page responds with HTTP 200.
- [ ] Open the generated page in the Windows browser.
