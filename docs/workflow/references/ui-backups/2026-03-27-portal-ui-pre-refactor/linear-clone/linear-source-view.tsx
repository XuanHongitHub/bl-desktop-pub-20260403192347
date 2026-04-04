import fs from "node:fs";
import path from "node:path";

function readFixture(fileName: string): string {
  const filePath = path.join(
    process.cwd(),
    "src/features/web/linear-clone/fixtures",
    fileName
  );
  return fs.readFileSync(filePath, "utf8");
}

function readJsonFixture<T>(fileName: string, fallback: T): T {
  try {
    const raw = readFixture(fileName);
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function transformHeaderHtml(rawHeaderHtml: string): string {
  let html = rawHeaderHtml
    .replaceAll('href="/homepage"', 'href="/"')
    .replaceAll('href="/about"', 'href="/desktop"')
    .replaceAll('href="/customers"', 'href="/desktop"')
    .replaceAll('href="/now"', 'href="/help"')
    .replaceAll('href="/contact"', 'href="/help"')
    .replaceAll('href="/docs"', 'href="/help"')
    .replaceAll('href="/download"', 'href="/help"')
    .replaceAll('href="/contact/sales"', 'href="/help"')
    .replaceAll('href="/login"', 'href="/auth"')
    .replaceAll('href="/signup"', 'href="/auth"')
    .replaceAll(">Open app</a>", ">Desktop app</a>");

  const labelMap: Record<string, string> = {
    Product: "Profiles",
    Resources: "Automation",
    Customers: "Proxy",
    Pricing: "Pricing",
    Now: "Docs",
    Contact: "Support",
  };

  for (const [from, to] of Object.entries(labelMap)) {
    html = html
      .replaceAll(`>${from}</button>`, `>${to}</button>`)
      .replaceAll(`>${from}</a>`, `>${to}</a>`);
  }

  if (!html.includes('id="buglogin-theme-switch"')) {
    const themeButtonItem =
      '<li class="Header_buttonItem__crtcc Header_item__a2E_K">' +
      '<button id="buglogin-theme-switch" type="button" class="Button_root__Stmhv Button_variant-invert__ECHZN Button_size-small__sjtMt Button_variant__1FJO9 reset_reset-button__5vBZ4" aria-label="Switch theme">' +
      '<span data-theme-icon aria-hidden="true">☾</span>' +
      "</button>" +
      "</li>";

    html = html.replace(
      '<div class="Header_buttons__qwTPf">',
      `<div class="Header_buttons__qwTPf">${themeButtonItem}`
    );
  }

  return html;
}

function transformContentHtml(rawContentHtml: string): string {
  return rawContentHtml
    .replaceAll('href="/next"', 'href="/help"')
    .replaceAll('href="/changelog"', 'href="/help"')
    .replaceAll('href="/customers"', 'href="/help"')
    .replaceAll(
      /opacity:\s*0(?:\.\d+)?;\s*filter:\s*blur\([^)]*\);\s*transform:\s*translateY\([^)]*\);/g,
      "opacity: 1; filter: blur(0px); transform: translateY(0%);"
    );
}

export function LinearSourceView() {
  const cssUrls = readJsonFixture<string[]>("linear-css-urls.json", []);
  const headerHtml = transformHeaderHtml(readFixture("linear-header.html"));
  const contentHtml = transformContentHtml(readFixture("linear-content.html"));
  const inlineStylesHtml = readFixture("linear-inline-styles.html");

  return (
    <div className="min-h-screen bg-background">
      {cssUrls.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}

      <div
        className="linear-source-page"
        data-theme="dark"
        suppressHydrationWarning
      >
        <div dangerouslySetInnerHTML={{ __html: inlineStylesHtml }} />

        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var THEME_KEY = "theme";
                var WEBSITE_THEME_KEY = "website-theme";

                function getRootTheme() {
                  var root = document.documentElement;
                  if (root.classList.contains("dark")) return "dark";
                  if (root.classList.contains("light")) return "light";

                  var saved = localStorage.getItem(THEME_KEY) || localStorage.getItem(WEBSITE_THEME_KEY);
                  if (saved === "dark" || saved === "light") return saved;

                  return window.matchMedia &&
                    window.matchMedia("(prefers-color-scheme: dark)").matches
                    ? "dark"
                    : "light";
                }

                function syncLinearTheme(theme) {
                  var nodes = document.querySelectorAll(".linear-source-page");
                  for (var i = 0; i < nodes.length; i++) {
                    nodes[i].setAttribute("data-theme", theme);
                  }
                }

                function syncButton(theme) {
                  var button = document.getElementById("buglogin-theme-switch");
                  if (!button) return;

                  button.setAttribute(
                    "aria-label",
                    theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
                  );

                  var icon = button.querySelector("[data-theme-icon]");
                  if (icon) icon.textContent = theme === "dark" ? "☀" : "☾";
                }

                function applyTheme(theme) {
                  var root = document.documentElement;
                  root.classList.remove("dark", "light");
                  root.classList.add(theme);
                  localStorage.setItem(THEME_KEY, theme);
                  localStorage.setItem(WEBSITE_THEME_KEY, theme);
                  syncLinearTheme(theme);
                  syncButton(theme);
                }

                applyTheme(getRootTheme());

                document.addEventListener("click", function (event) {
                  var target = event.target;
                  if (!target) return;
                  var button = target.closest("#buglogin-theme-switch");
                  if (!button) return;

                  event.preventDefault();
                  var nextTheme = getRootTheme() === "dark" ? "light" : "dark";
                  applyTheme(nextTheme);
                });
              })();
            `,
          }}
        />

        <a className="SkipNav_root__DcHPR" href="#skip-nav">
          Skip to content →
        </a>

        <div className="Layout_container__BVtmP page_root__EA6JT">
          <div
            className="Header_root__x8J2p"
            data-header=""
            dangerouslySetInnerHTML={{ __html: headerHtml }}
          />
          <main className="Layout_content__PrPCk">
            <div id="skip-nav" />
            <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
          </main>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .linear-source-page {
              min-height: 100vh;
            }

            .linear-source-page .Layout_container__BVtmP {
              min-height: 100vh;
            }

            .linear-source-page .LayoutContent_homepage__alayp {
              background: var(--color-bg-primary);
            }

            .linear-source-page .Hero_container__inGFW [style*="opacity:0"],
            .linear-source-page .Hero_container__inGFW [style*="opacity: 0"] {
              opacity: 1 !important;
              filter: blur(0px) !important;
              transform: translateY(0%) !important;
            }

            .linear-source-page .Frame_wrapper___hKDg [style*="opacity:0"],
            .linear-source-page .Frame_wrapper___hKDg [style*="opacity: 0"] {
              opacity: 1 !important;
            }

            .linear-source-page #buglogin-theme-switch {
              min-width: 34px;
              justify-content: center;
              gap: 0;
              padding-left: 9px;
              padding-right: 9px;
              cursor: pointer;
            }

            .linear-source-page #buglogin-theme-switch [data-theme-icon] {
              display: inline-flex;
              width: 14px;
              justify-content: center;
              font-size: 14px;
              line-height: 1;
            }
          `,
        }}
      />
    </div>
  );
}
