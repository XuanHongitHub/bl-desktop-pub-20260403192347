import { AdminUserDetailPage } from "@/components/portal/admin/users/admin-user-detail-page";

export function generateStaticParams() {
  return [{ userId: "placeholder" }];
}

export default async function AdminUserDetailRoute({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <AdminUserDetailPage userId={userId} />;
}
