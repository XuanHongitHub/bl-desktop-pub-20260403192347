import fs from "node:fs";
import path from "node:path";
import { PortalHeader } from "@/components/portal/portal-header";
import { PortalHomeRuntime } from "@/features/web/portal-home/portal-home-runtime";

function readFixture(fileName: string): string {
  const filePath = path.join(
    process.cwd(),
    "src/features/web/portal-home/fixtures",
    fileName,
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

function transformContentHtml(rawContentHtml: string): string {
  let html = rawContentHtml
    .replaceAll('href="/next"', 'href="/help"')
    .replaceAll('href="/changelog"', 'href="/help"')
    .replaceAll('href="/customers"', 'href="/help"');

  const contentReplacements: Array<[string, string]> = [
    ["The product", "The antidetect"],
    ["development", "browser"],
    ["and agents", "and operators"],
    ["system for teams and agents", "system for teams and operators"],
    [
      "Purpose-built for planning and building products. Designed for the AI era.",
      "Purpose-built for antidetect browsing, profile isolation, and automation safety at scale.",
    ],
    ["Issue tracking is dead", "Profile launch is stable"],
    ["linear.app/next", "buglogin.com/profiles"],
    ["Faster app launch", "Profile D-0318"],
    [
      "Render UI before vehicle_state sync when minimum required state is present, instead of blocking on full refresh during iOS startup.",
      "Load isolated profile state before opening the browser, so users can launch safely without a full sync reset.",
    ],
    ["02 / 145", "56 / 2000"],
    ["02/145", "56/2000"],
    ["ENG-2703", "PF-2703"],
    ["In Progress", "Ready"],
    ["High", "Stable"],
    ["Labels", "Profile health"],
    [
      "A new species of product tool. Purpose-built for modern teams with AI workflows at its core, Linear sets a new standard for planning and building products.",
      "An antidetect browser platform for modern teams, built around isolated profiles, reliable proxies, and resilient automation workflows.",
    ],
    [
      "Make product operations self-driving",
      "Make browser operations self-driving",
    ],
    ["Define the product direction", "Define antidetect browser policy"],
    [
      "Move work forward across teams and agents",
      "Move profiles safely across teams and operators",
    ],
    [
      "Review PRs and agent output",
      "Review automation runs and operator actions",
    ],
    ["Understand progress at scale", "Understand browser health at scale"],
    ["Changelog", "Release notes"],
    [
      "Built for the future. Available today.",
      "Built for secure operations. Available today.",
    ],
    ["Customer stories", "Security use cases"],
    ["See all releases", "See antidetect updates"],
    ["Get started", "Start secure browsing"],
    ["Contact sales", "Talk to us"],
    ["Open app", "Open desktop app"],
    ["Download", "Download app"],
    ["Inbox", "Profiles"],
    ["My issues", "Profile list"],
    ["Reviews", "Session logs"],
    ["Pulse", "Sync status"],
    ["Initiatives", "Groups"],
    ["Projects", "Proxy routes"],
    ["Favorites", "Pinned profiles"],
    ["Agent tasks", "Launch queue"],
    ["Agents Insights", "Fingerprint insights"],
    [
      "Linear created the issue via Slack on behalf of karri · 2min ago",
      "BugLogin synced profile D-0318 from cloud workspace · 2min ago",
    ],
    [
      "Triage Intelligence added the label Performance and iOS · 2min ago",
      "Sync engine validated cookie + proxy snapshot · 2min ago",
    ],
    [
      "Right now we show a spinner forever, which makes it look the car disappeared…",
      "Proxy auth can fail and keep a profile in opening state, which makes it look like the session disappeared…",
    ],
    [
      "@Codex can you take a stab at this?",
      "@Runner can recheck this profile route?",
    ],
    ["jori connected Codex · just now", "user connected Runner · just now"],
    ["Examining issue ENG-2703", "Examining profile PF-2703"],
    [
      "Codex moved from Todo to In Progress · just now",
      "Runner moved from Checking to Ready · just now",
    ],
    [
      "On it! I've received your request.",
      "Received. Checking profile health and launch signals.",
    ],
    [
      "Kicked off a task in kinetic/kinetic-iOS environment.",
      "Started a task in browser-runtime/windows-x64 profile sandbox.",
    ],
    ["Searching for root AGENTS file", "Scanning for active profile workspace"],
    [
      "kinetic/kinetic-iOS$ /bin/bash -lc rg --files -g 'AGENTS.md' AGENTS.md",
      "browser-runtime/windows-x64$ verify --profiles --cookies --proxy --launch",
    ],
    [
      "Locating initialization logic for vehicle_state",
      "Locating launch bootstrap logic for profile_state",
    ],
    ["Activity", "Profile activity"],
    ["car disappeared", "session disappeared"],
    ["02 / 145", "56 / 2000"],
    ["BL-2703", "PF-2703"],
    ["Running", "Ready"],
    ["High risk", "Stable"],
    ["Signals", "Profile health"],
    ["Thinking.", "Reviewing."],
    ["karri", "ops"],
    ["jori", "operator"],
    ["created the issue via Slack", "synced a profile event via cloud queue"],
    [
      "synced a profile event via cloud queue on behalf of ops · 2min ago",
      "synced profile D-0318 from cloud workspace · 2min ago",
    ],
    ["Triage Intelligence", "Sync Engine"],
    [
      "added the label Performance and runtime",
      "validated cookie + proxy integrity",
    ],
    [
      "Sync Engine validated cookie + proxy integrity · 2min ago",
      "Sync engine validated proxy + cookie integrity · 2min ago",
    ],
    [
      "@ Runner can you take a stab at this?",
      "@ Runner can validate this profile route?",
    ],
    ["Examining issue PF-2703", "Examining profile PF-2703"],
    ["Examining issue", "Examining profile"],
    ["Todo to Ready", "Checking to Ready"],
    [
      "On it! I've received your request.",
      "Received. Preparing profile launch diagnostics.",
    ],
    [
      "Kicked off a task in kinetic/kinetic-runtime environment.",
      "Started a task in browser-runtime/windows-x64 profile sandbox.",
    ],
    [
      "Locating initialization logic for fingerprint_state",
      "Locating launch bootstrap logic for profile_state",
    ],
    ["Thinking ...", "Reviewing launch state ..."],
    [
      "planning and building products.",
      "launching and managing browser profiles.",
    ],
    [
      "A new species of browser tool.",
      "A new species of antidetect browser tool.",
    ],
    [
      "A screenshot of the Linear app showing the issue that's currently in progress",
      "A screenshot of the BugLogin app showing a user profile workspace currently in progress",
    ],
    [
      "You just have to use it and you will see, you will just feel it.",
      "Once profile isolation is configured right, your team can feel the stability immediately.",
    ],
    [
      "Our speed is intense and Linear helps us be action biased.",
      "Our execution speed is intense and BugLogin keeps automation action-biased and stable.",
    ],
    [
      "Linear is excellent, just excellent. It has the right opinions for fast moving teams.",
      "BugLogin is excellent for fast-moving teams that need reliable antidetect browser operations.",
    ],
    ["Linear powers over", "BugLogin powers over"],
    [
      "product teams. From ambitious startups to major enterprises.",
      "automation teams. From focused squads to large operations.",
    ],
    [
      "Advanced filters and share issues in private teams",
      "Advanced filters and share profiles in private teams",
    ],
    [
      "Refine your searches, views, and dashboards with advanced filters. Combine multiple AND/OR conditions to define exactly what you want to see.",
      "Refine profile searches, run views, and dashboards with advanced filters. Combine AND/OR conditions to target exactly what operations need.",
    ],
    [">Linear<", ">BugLogin<"],
  ];

  for (const [from, to] of contentReplacements) {
    html = html.replaceAll(from, to);
  }

  html = html
    .replace(/\bLinear\b/g, "BugLogin")
    .replace(/\bproduct\b/gi, "browser")
    .replace(/\bagents?\b/gi, "operators")
    .replace(/\bIssue\b/g, "Run")
    .replace(/\bissues\b/g, "profiles")
    .replace(/\bCodex\b/g, "Runner")
    .replace(/\biOS\b/g, "runtime")
    .replace(/vehicle_state/g, "fingerprint_state")
    .replace(/0?2\s*\/\s*145/g, "56 / 2000")
    .replace(
      /A screenshot of the BugLogin app showing the issue that&#x27;s currently in progress/g,
      "A screenshot of the BugLogin app showing a user profile workspace currently in progress",
    )
    .replace(/created the issue via/g, "synced profile D-0318 via")
    .replace(/added the label/g, "validated")
    .replace(
      /can you take a stab at this\?/g,
      "can you validate this profile route?",
    )
    .replace(/Kicked off a task in/g, "Started a task in")
    .replace(
      /Locating initialization logic for/g,
      "Locating launch bootstrap logic for",
    )
    .replace(/Thinking/g, "Reviewing launch state")
    .replace(
      /A new species of browser tool\./g,
      "A new species of antidetect browser tool.",
    )
    .replace(/Todo to Ready/g, "Checking to Ready")
    .replace(/\bNew issue\b/g, "New profile")
    .replace(
      /showing the issue that&#x27;s currently in progress/g,
      "showing a user profile workspace currently active",
    )
    .replace(
      /On it! I&#x27;ve received your request\./g,
      "Received. Preparing profile launch diagnostics.",
    )
    .replace(/kinetic\/kinetic-runtime/g, "browser-runtime/windows-x64")
    .replace(/fingerprint_state/g, "profile_state")
    .replaceAll(
      '<span class="sc-d5151d0-0 emXsJC">02</span><span>/</span><span>145</span>',
      '<span class="sc-d5151d0-0 emXsJC">56</span><span>/</span><span>2000</span>',
    )
    .replaceAll(
      'validated<!-- --> <span class="sc-d5151d0-0 fURFqh">Performance</span> and <span class="sc-d5151d0-0 fURFqh">runtime</span>',
      'validated<!-- --> <span class="sc-d5151d0-0 fURFqh">Proxy</span> + <span class="sc-d5151d0-0 fURFqh">Cookie integrity</span>',
    );

  const heroPreviewReplacements: Array<[string, string]> = [
    ['aria-label="Previous issue"', 'aria-label="Previous profile"'],
    ['aria-label="Next issue"', 'aria-label="Next profile"'],
    ['aria-label="Copy issue URL"', 'aria-label="Copy profile URL"'],
    ['aria-label="Copy issue ID"', 'aria-label="Copy profile ID"'],
    [
      'Render UI before <code class="IssueView_code__zgYnp">fingerprint_state</code> sync when minimum required state is present, instead of blocking on full refresh during runtime startup.',
      'Load UI with <code class="IssueView_code__zgYnp">profile_state</code> first, then complete sync in background to keep profile launch responsive.',
    ],
    [
      'synced profile D-0318 via <span class="sc-d5151d0-0 fURFqh">Slack</span> on behalf of <span class="sc-d5151d0-0 fURFqh">ops</span>',
      'synced profile D-0318 from <span class="sc-d5151d0-0 fURFqh">workspace queue</span>',
    ],
    [
      '<span class="sc-d5151d0-0 fURFqh">Sync Engine</span> validated<!-- --> <span class="sc-d5151d0-0 fURFqh">Performance</span> and <span class="sc-d5151d0-0 fURFqh">runtime</span>',
      '<span class="sc-d5151d0-0 fURFqh">Sync engine</span> validated<!-- --> <span class="sc-d5151d0-0 fURFqh">Proxy + Cookie integrity</span>',
    ],
    [
      '<span class="sc-d5151d0-0 fURFqh">Runner</span> moved from <span class="sc-d5151d0-0 fURFqh">Todo</span> to<!-- --> <span class="sc-d5151d0-0 fURFqh">Ready</span>',
      '<span class="sc-d5151d0-0 fURFqh">Runner</span> moved from <span class="sc-d5151d0-0 fURFqh">Checking</span> to<!-- --> <span class="sc-d5151d0-0 fURFqh">Ready</span>',
    ],
    [
      'Started a task in<!-- --> <span class="sc-d5151d0-0 dRSbPB">kinetic/kinetic-runtime</span> <!-- -->environment.',
      'Started a task in<!-- --> <span class="sc-d5151d0-0 dRSbPB">browser-runtime/windows-x64</span> <!-- -->profile sandbox.',
    ],
    [
      "kinetic/kinetic-runtime$ /bin/bash -lc rg --files -g &#x27;operators.md&#x27; operators.md",
      "browser-runtime/windows-x64$ verify --profiles --cookies --proxy --launch",
    ],
    [
      'Locating launch bootstrap logic for<!-- --> <span class="sc-d5151d0-0 dRSbPB">fingerprint_state</span>',
      'Locating launch bootstrap logic for<!-- --> <span class="sc-d5151d0-0 dRSbPB">profile_state</span>',
    ],
  ];

  for (const [from, to] of heroPreviewReplacements) {
    html = html.replaceAll(from, to);
  }

  const heroPreviewRegexFallbacks: Array<[RegExp, string]> = [
    [
      /Render UI before\s*<code[^>]*>profile_state<\/code>\s*sync when minimum required state is present, instead of blocking on full refresh during runtime startup\./g,
      'Load UI with <code class="IssueView_code__zgYnp">profile_state</code> first, then complete sync in background so profile launch stays responsive.',
    ],
    [/aria-label="Previous issue"/g, 'aria-label="Previous profile"'],
    [/aria-label="Next issue"/g, 'aria-label="Next profile"'],
    [/aria-label="Copy issue URL"/g, 'aria-label="Copy profile URL"'],
    [/aria-label="Copy issue ID"/g, 'aria-label="Copy profile ID"'],
    [/aria-label="Add issue"/g, 'aria-label="Add profile"'],
    [
      /browser-runtime\/windows-x64\$ \/bin\/bash -lc rg --files -g &#x27;operators\.md&#x27; operators\.md/g,
      "browser-runtime/windows-x64$ verify --profiles --cookies --proxy --launch",
    ],
    [
      /Started a task in(?:<!-- -->\s*)?<span[^>]*>browser-runtime\/windows-x64<\/span>(?:\s*<!-- -->)?\s*environment\./g,
      'Started a task in<!-- --> <span class="sc-d5151d0-0 dRSbPB">browser-runtime/windows-x64</span> <!-- -->profile sandbox.',
    ],
    [
      /synced profile D-0318 via\s*<span[^>]*>Slack<\/span>\s*on behalf of\s*<span[^>]*>ops<\/span>/g,
      'synced profile D-0318 from <span class="sc-d5151d0-0 fURFqh">workspace queue</span>',
    ],
    [/\bTodo\b/g, "Checking"],
    [/\bTriage\b/g, "Routing"],
    [
      /Performance<\/span> and <span class="sc-d5151d0-0 fURFqh">runtime/g,
      "Proxy + Cookie integrity</span>",
    ],
  ];

  for (const [pattern, replacement] of heroPreviewRegexFallbacks) {
    html = html.replace(pattern, replacement);
  }

  return html;
}

export function PortalHomeView() {
  const cssUrls = readJsonFixture<string[]>("source-css-urls.json", []);
  const contentHtml = transformContentHtml(readFixture("source-content.html"));
  const inlineStylesHtml = readFixture("source-inline-styles.html");

  return (
    <div className="min-h-screen bg-background">
      {cssUrls.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}

      <div
        className="portal-source-page"
        data-theme="dark"
        suppressHydrationWarning
      >
        <div dangerouslySetInnerHTML={{ __html: inlineStylesHtml }} />
        <PortalHomeRuntime />

        <a className="SkipNav_root__DcHPR" href="#skip-nav">
          Skip to content →
        </a>

        <div className="Layout_container__BVtmP page_root__EA6JT">
          <div className="buglogin-shared-header" data-header="">
            <PortalHeader />
          </div>
          <main className="Layout_content__PrPCk">
            <div id="skip-nav" />
            <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
          </main>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .portal-source-page {
              min-height: 100vh;
            }

            .portal-source-page .Layout_container__BVtmP {
              min-height: 100vh;
            }

            .portal-source-page .LayoutContent_homepage__alayp {
              background: var(--color-bg-primary);
            }

            .portal-source-page .Hero_container__inGFW [style*="opacity:0"],
            .portal-source-page .Hero_container__inGFW [style*="opacity: 0"] {
              opacity: 1 !important;
              filter: blur(0px) !important;
              transform: translateY(0%) !important;
            }

            .portal-source-page .Frame_wrapper___hKDg [style*="opacity:0"],
            .portal-source-page .Frame_wrapper___hKDg [style*="opacity: 0"] {
              opacity: 1 !important;
            }

            .portal-source-page .buglogin-shared-header {
              position: sticky;
              top: 0;
              z-index: 60;
            }
          `,
        }}
      />
    </div>
  );
}
