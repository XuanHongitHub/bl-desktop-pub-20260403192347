import { AdminUserEditPage } from "@/components/portal/admin/users/admin-user-edit-page";

export function generateStaticParams() {
  return [{ userId: "placeholder" }];
}

export default async function AdminUserEditRoute({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <AdminUserEditPage userId={userId} />;
}
