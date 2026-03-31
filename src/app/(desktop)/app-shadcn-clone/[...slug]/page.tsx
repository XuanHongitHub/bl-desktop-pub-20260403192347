import { ShadcnCloneRouteViewer } from "@/frontend-shadcn/components/shadcn-clone-route-viewer";

type DesktopShadcnCloneCatchAllPageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

export default async function DesktopShadcnCloneCatchAllPage({
  params,
}: DesktopShadcnCloneCatchAllPageProps) {
  const { slug } = await params;
  return <ShadcnCloneRouteViewer surface="desktop" slug={slug} />;
}
