import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const source = readFileSync("src/components/data-table-action-bar.tsx", "utf8");

assert.doesNotMatch(
  source,
  /fixed inset-x-0 bottom-6 z-50 mx-auto flex w-fit flex-wrap items-center justify-center/,
  "Data table action bar should not center itself in the viewport",
);

assert.match(
  source,
  /fixed right-6 bottom-6 z-50 flex max-w-\[calc\(100%-3rem\)\] flex-wrap items-center justify-end/,
  "Data table action bar should anchor to the edge of the window",
);

console.log("data table action bar layout guard passed");
