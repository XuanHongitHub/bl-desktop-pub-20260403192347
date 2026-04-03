import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const source = readFileSync(
  "src/app/(desktop)/desktop/desktop-client-page.tsx",
  "utf8",
);

assert.match(
  source,
  /<main className="app-shell-safe flex min-w-0 flex-1 flex-col overflow-hidden pl-3 pb-2\.5 md:pl-4 md:pb-3">/,
  "App shell main should keep left spacing but not inset the right edge with symmetric padding",
);

assert.doesNotMatch(
  source,
  /px-4 pb-4 md:px-6 md:pb-6/,
  "App shell main should not keep symmetric horizontal padding that pushes the scroll container away from the edge",
);

console.log("app shell layout guard passed");
