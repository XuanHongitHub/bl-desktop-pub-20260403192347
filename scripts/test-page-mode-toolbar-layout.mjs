import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const proxySource = readFileSync(
  "src/components/proxy-management-dialog.tsx",
  "utf8",
);
const integrationsSource = readFileSync(
  "src/components/integrations-dialog.tsx",
  "utf8",
);

assert.match(
  proxySource,
  /toolbar=/,
  "Proxy management page-mode should use the toolbar slot for tabs or secondary navigation",
);

assert.match(
  integrationsSource,
  /toolbar=/,
  "Integrations page-mode should use the toolbar slot for tabs or secondary navigation",
);

assert.doesNotMatch(
  proxySource,
  /actions=\{\s*<Tabs/,
  "Proxy management page-mode should not keep tabs in the primary actions slot",
);

assert.doesNotMatch(
  integrationsSource,
  /actions=\{\s*<Tabs/,
  "Integrations page-mode should not keep tabs in the primary actions slot",
);

console.log("page mode toolbar layout guard passed");
