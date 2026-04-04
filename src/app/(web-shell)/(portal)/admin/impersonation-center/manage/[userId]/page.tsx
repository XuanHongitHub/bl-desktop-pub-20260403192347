import { redirect } from "next/navigation";

export function generateStaticParams() {
  return [{ userId: "placeholder" }];
}

export default async function AdminImpersonationManageByUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const encodedUserId = encodeURIComponent(userId);
  const query = `?userId=${encodedUserId}&mode=detail`;
  redirect(`/admin/impersonation-center/manage${query}`);
}
