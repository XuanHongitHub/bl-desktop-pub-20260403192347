import { redirect } from "next/navigation";

export function generateStaticParams() {
  return [{ userId: "placeholder" }];
}

export default async function AdminUsersManageByIdPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  redirect(`/admin/users/${encodeURIComponent(userId)}`);
}
