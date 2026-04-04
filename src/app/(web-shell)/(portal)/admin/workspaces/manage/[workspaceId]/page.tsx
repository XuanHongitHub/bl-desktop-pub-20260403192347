import { redirect } from "next/navigation";

export function generateStaticParams() {
  return [{ workspaceId: "placeholder" }];
}

export default async function AdminWorkspaceManageByIdPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const encodedWorkspaceId = encodeURIComponent(workspaceId);
  const query = `?workspaceId=${encodedWorkspaceId}&mode=detail`;
  redirect(`/admin/workspaces/manage${query}`);
}
