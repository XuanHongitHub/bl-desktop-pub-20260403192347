import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const source = readFileSync("src/components/profiles-workspace-chrome.tsx", "utf8");

assert.match(
  source,
  /export function ProfilesWorkspaceHeaderActions/,
  "Profiles workspace chrome should expose header actions separately from utilities",
);

assert.match(
  source,
  /export function ProfilesWorkspaceToolbar/,
  "Profiles workspace chrome should expose a subordinate toolbar row",
);

assert.doesNotMatch(
  source,
  /className="flex items-center justify-end gap-2"/,
  "Profiles workspace chrome should not keep the old monolithic right-aligned action row",
);

assert.match(
  source,
  /<Button[\s\S]*?onClick=\{\(\) => \{\s*onCreateProfileDialogOpen\(true\);\s*\}\}[\s\S]*?<GoPlus className="h-(?:3\.5|4) w-(?:3\.5|4)" \/>[\s\S]*?\{t\("header\.createProfile"\)\}/s,
  "Profiles primary CTA should be a labeled create button, not an icon-only tooltip trigger",
);

console.log("profiles workspace chrome guard passed");
