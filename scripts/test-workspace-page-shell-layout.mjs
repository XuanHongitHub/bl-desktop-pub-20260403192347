import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const source = readFileSync("src/components/workspace-page-shell.tsx", "utf8");

assert.match(
  source,
  /className=\{cn\(\s*"[^"]*flex[^"]*min-h-0[^"]*min-w-0[^"]*flex-1[^"]*flex-col[^"]*overflow-hidden[^"]*"/,
  "Workspace page shell should expand with flex-1 so page-mode content gets a real scroll height",
);

assert.match(
  source,
  /<ScrollArea className="(?=[^"]*\bmin-h-0\b)(?=[^"]*\bflex-1\b)[^"]*"/,
  "Workspace page shell should keep the page body inside a shrinkable ScrollArea",
);

assert.doesNotMatch(
  source,
  /-mr-4 md:-mr-6/,
  "Workspace page shell should not push the scroll area outside an overflow-hidden shell because it clips the scrollbar",
);

assert.doesNotMatch(
  source,
  /disableContentScroll/,
  "Workspace page shell should not keep a dead escape hatch once the shared scroll contract is normalized",
);

assert.doesNotMatch(
  source,
  /pr-2 md:pr-3/,
  "Workspace page shell should not keep the old overlay-scrollbar compensation padding",
);

assert.match(
  source,
  /w-full space-y-3 pr-2\.5 pb-3 md:pr-3/,
  "Workspace page shell should keep a small content gutter without moving the scrollbar off the edge",
);

console.log("workspace page shell layout guard passed");
