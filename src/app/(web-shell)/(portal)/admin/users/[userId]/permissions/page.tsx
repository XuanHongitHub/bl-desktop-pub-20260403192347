import { AdminUserPermissionsPage } from "@/components/portal/admin/users/admin-user-permissions-page";

export function generateStaticParams() {
  return [{ userId: "placeholder" }];
}

export default async function AdminUserPermissionsRoute({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <AdminUserPermissionsPage userId={userId} />;
}
