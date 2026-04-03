import { redirect } from "next/navigation";

export default async function AdminUsersManageByIdPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const encodedUserId = encodeURIComponent(userId);
  redirect(`/admin/users/manage?userId=${encodedUserId}&mode=detail`);
}
