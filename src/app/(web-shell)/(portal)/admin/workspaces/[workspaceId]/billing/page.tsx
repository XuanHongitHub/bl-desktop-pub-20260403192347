import { redirect } from "next/navigation";

export function generateStaticParams() {
  return [{ workspaceId: "placeholder" }];
}

export default async function AdminWorkspaceBillingRoutePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const encodedWorkspaceId = encodeURIComponent(workspaceId);
  redirect(
    `/admin/workspaces/manage?workspaceId=${encodedWorkspaceId}&mode=detail&section=subscription`,
  );
}
