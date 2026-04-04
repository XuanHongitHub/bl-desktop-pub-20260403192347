import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const source = readFileSync("src/components/ui/badge.tsx", "utf8");

assert.doesNotMatch(
  source,
  /overflow-hidden/,
  "Badge should not clip long localized text or descenders",
);

console.log("badge layout guard passed");
