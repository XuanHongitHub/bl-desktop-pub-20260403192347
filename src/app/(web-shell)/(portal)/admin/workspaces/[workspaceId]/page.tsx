import { redirect } from "next/navigation";

export default async function AdminWorkspaceDetailsRoutePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const encodedWorkspaceId = encodeURIComponent(workspaceId);
  redirect(
    `/admin/workspaces/manage?workspaceId=${encodedWorkspaceId}&mode=detail`,
  );
}
