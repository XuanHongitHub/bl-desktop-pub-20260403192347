import { ShadcnCloneRouteViewer } from "@/frontend-shadcn/components/shadcn-clone-route-viewer";

type WebShadcnCloneCatchAllPageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

export default async function WebShadcnCloneCatchAllPage({
  params,
}: WebShadcnCloneCatchAllPageProps) {
  const { slug } = await params;
  return <ShadcnCloneRouteViewer surface="web" slug={slug} />;
}
