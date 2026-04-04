import shadcnUrlManifest from "@/frontend-shadcn/data/shadcn-url-manifest.json";

export type CloneSurface = "web" | "desktop";
export type ShadcnCloneRouteGroup =
  | "docs"
  | "components"
  | "blocks"
  | "charts"
  | "examples"
  | "themes"
  | "other";

export type ShadcnCloneRouteEntry = {
  index: number;
  url: string;
  pathname: string;
  sourcePath: string;
  slug: string[];
  slugKey: string;
  routePath: string;
  group: ShadcnCloneRouteGroup;
  label: string;
};

const grouped = shadcnUrlManifest.grouped as Record<string, string[]>;
const urls = shadcnUrlManifest.urls as string[];

const groupByUrl = new Map<string, ShadcnCloneRouteGroup>();

Object.entries(grouped).forEach(([group, list]) => {
  const normalizedGroup = (group as ShadcnCloneRouteGroup) ?? "other";
  list.forEach((url) => {
    groupByUrl.set(url, normalizedGroup);
  });
});

function toSlug(pathname: string): string[] {
  const trimmed = pathname.replace(/^\/+|\/+$/g, "");
  return trimmed ? trimmed.split("/") : [];
}

function toLabel(pathname: string): string {
  const segments = toSlug(pathname);
  const tail = segments.at(-1);
  if (!tail) {
    return "/";
  }
  return tail
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export const SHADCN_CLONE_ROUTE_ENTRIES: ShadcnCloneRouteEntry[] = urls.map(
  (url, index) => {
    const pathname = new URL(url).pathname;
    const sourcePath = pathname || "/";
    const slug = toSlug(sourcePath);
    const slugKey = slug.join("/");
    const group = groupByUrl.get(url) ?? "other";

    return {
      index: index + 1,
      url,
      pathname,
      sourcePath,
      slug,
      slugKey,
      routePath: slugKey ? `/${slugKey}` : "/",
      group,
      label: toLabel(pathname),
    };
  },
);

const entryBySlugKey = new Map<string, ShadcnCloneRouteEntry>(
  SHADCN_CLONE_ROUTE_ENTRIES.map((entry) => [entry.slugKey, entry]),
);

const fallbackEntry =
  SHADCN_CLONE_ROUTE_ENTRIES.find(
    (entry) => entry.pathname === "/examples/dashboard",
  ) ?? SHADCN_CLONE_ROUTE_ENTRIES[0];

export const SHADCN_CLONE_ROUTE_GROUP_ORDER: ShadcnCloneRouteGroup[] = [
  "examples",
  "components",
  "blocks",
  "charts",
  "docs",
  "themes",
  "other",
];

export function getCloneRouteBase(surface: CloneSurface): string {
  return surface === "desktop" ? "/app-shadcn-clone" : "/shadcn-clone";
}

export function resolveCloneRouteEntry(slug?: string[]): ShadcnCloneRouteEntry {
  if (!slug?.length) {
    return fallbackEntry;
  }
  return entryBySlugKey.get(slug.join("/")) ?? fallbackEntry;
}

export function getCloneRouteHref(
  surface: CloneSurface,
  slug?: string[],
): string {
  const base = getCloneRouteBase(surface);
  if (!slug?.length) {
    return base;
  }
  return `${base}/${slug.join("/")}`;
}

export function getCloneRouteHrefForEntry(
  surface: CloneSurface,
  entry: ShadcnCloneRouteEntry,
): string {
  return getCloneRouteHref(surface, entry.slug);
}
