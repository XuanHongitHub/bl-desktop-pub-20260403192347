import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const source = readFileSync("src/components/workspace-page-shell.tsx", "utf8");

assert.match(
  source,
  /toolbar\?: ReactNode;/,
  "WorkspacePageShell should expose a dedicated toolbar slot for subordinate actions",
);

assert.match(
  source,
  /\{toolbar &&\s*\(\s*<div className=\{cn\("mt-2", toolbarClassName\)\}>/s,
  "WorkspacePageShell should render the toolbar below the title row",
);

console.log("workspace page shell toolbar guard passed");
