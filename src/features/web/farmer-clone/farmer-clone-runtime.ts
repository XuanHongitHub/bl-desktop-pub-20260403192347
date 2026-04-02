import fs from "node:fs/promises";
import path from "node:path";

export const FARMER_CLONE_SLUGS = [
  "create-collaborate-go-live",
  "scale-without-switching-tools",
  "pro-help-handpicked-experts",
] as const;

export type FarmerCloneSlug = (typeof FARMER_CLONE_SLUGS)[number];

const FIXTURE_ROOT = path.join(
  process.cwd(),
  "src/features/web/farmer-clone/fixtures",
);

export function resolveFarmerCloneSlug(
  slug?: string[],
): FarmerCloneSlug | null {
  if (!slug || slug.length === 0) {
    return "create-collaborate-go-live";
  }

  const key = slug.join("/");
  if ((FARMER_CLONE_SLUGS as readonly string[]).includes(key)) {
    return key as FarmerCloneSlug;
  }

  return null;
}

export async function readFarmerCloneDocument(
  slug: FarmerCloneSlug,
): Promise<string> {
  const docPath = path.join(FIXTURE_ROOT, slug, "source-document.html");
  return fs.readFile(docPath, "utf8");
}
