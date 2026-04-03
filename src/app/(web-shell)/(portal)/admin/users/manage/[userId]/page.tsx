import { redirect } from "next/navigation";

export default async function AdminUsersManageByIdPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  redirect(`/admin/users/${encodeURIComponent(userId)}`);
}
