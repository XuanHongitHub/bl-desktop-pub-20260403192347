import { redirect } from "next/navigation";

export default async function AdminWorkspaceManageByIdPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams?: Promise<{ section?: string }>;
}) {
  const { workspaceId } = await params;
  const encodedWorkspaceId = encodeURIComponent(workspaceId);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const section = resolvedSearchParams.section?.trim();
  const query = section
    ? `?workspaceId=${encodedWorkspaceId}&mode=detail&section=${encodeURIComponent(section)}`
    : `?workspaceId=${encodedWorkspaceId}&mode=detail`;
  redirect(`/admin/workspaces/manage${query}`);
}
