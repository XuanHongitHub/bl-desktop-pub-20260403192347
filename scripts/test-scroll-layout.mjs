import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const scrollAreaSource = readFileSync("src/components/ui/scroll-area.tsx", "utf8");
const createProfileSource = readFileSync(
  "src/components/create-profile-dialog.tsx",
  "utf8",
);
const profileInfoSource = readFileSync(
  "src/components/profile-info-dialog.tsx",
  "utf8",
);
const vpnFormSource = readFileSync("src/components/vpn-form-dialog.tsx", "utf8");

assert.match(
  scrollAreaSource,
  /data-slot="scroll-area"/,
  "ScrollArea should keep its public slot marker for styling and tests",
);

assert.match(
  scrollAreaSource,
  /app-scroll-gutter/,
  "ScrollArea should use the global thin native scrollbar gutter contract",
);

assert.doesNotMatch(
  scrollAreaSource,
  /ScrollAreaPrimitive/,
  "ScrollArea should not mount Radix custom scrollbars when the app has a global thin native scrollbar contract",
);

assert.match(
  scrollAreaSource,
  /overflow-auto/,
  "ScrollArea should expose native overflow scrolling",
);

assert.doesNotMatch(
  scrollAreaSource,
  /ScrollBar/,
  "ScrollArea should not keep a dead custom scrollbar export once the native contract is in place",
);

assert.match(
  createProfileSource,
  /<ScrollArea className="[^"]*min-h-0[^"]*flex-1[^"]*"/,
  "Create Profile dialog should use a shrinkable ScrollArea",
);

assert.doesNotMatch(
  profileInfoSource,
  /<ScrollArea className="[^"]*pr-1/,
  "Profile info dialog should not keep overlay-scrollbar padding compensation",
);

assert.doesNotMatch(
  vpnFormSource,
  /<ScrollArea className="[^"]*pr-4/,
  "VPN form dialog should not keep overlay-scrollbar padding compensation",
);

console.log("scroll layout guard passed");
