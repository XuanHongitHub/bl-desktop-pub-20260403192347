import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const source = readFileSync("src/components/create-profile-dialog.tsx", "utf8");

assert.match(
  source,
  /<DialogContent[\s\S]*className=\{cn\(/s,
  "Create Profile dialog should use the same clipped flex-column pattern as the dialogs that already scroll correctly",
);

assert.match(
  source,
  /"my-8 flex w-full max-w-3xl flex-col overflow-hidden p-0"/,
  "Create Profile dialog should keep clipped flex column base classes",
);

assert.match(
  source,
  /mode === "dialog" \? "max-h-\[90vh\]" : "h-\[calc\(100vh-96px\)\]"/,
  "Create Profile dialog should cap modal height in dialog mode",
);

assert.match(
  source,
  /max-w-3xl/,
  "Create Profile dialog should keep the normalized modal width",
);

assert.doesNotMatch(
  source,
  /sm:max-w-5xl|sm:max-w-4xl/,
  "Create Profile dialog should not regress to legacy hardcoded tailwind size classes",
);

assert.match(
  source,
  /<ScrollArea className="[^"]*min-h-0[^"]*flex-1[^"]*"/,
  "Create Profile dialog should keep the body inside a shrinkable ScrollArea",
);

assert.match(
  source,
  /<Tabs[\s\S]*className="[^"]*flex[^"]*min-h-0[^"]*w-full[^"]*flex-1[^"]*flex-col[^"]*"/s,
  "Create Profile dialog tabs should fill the middle area and remain shrinkable",
);

console.log("create-profile layout guard passed");
