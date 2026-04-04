import { redirect } from "next/navigation";

export function generateStaticParams() {
  return [{ userId: "placeholder" }];
}

export default async function AdminImpersonationManageByUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams?: Promise<{ section?: string }>;
}) {
  const { userId } = await params;
  const encodedUserId = encodeURIComponent(userId);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const section = resolvedSearchParams.section?.trim();
  const query = section
    ? `?userId=${encodedUserId}&mode=detail&section=${encodeURIComponent(section)}`
    : `?userId=${encodedUserId}&mode=detail`;
  redirect(`/admin/impersonation-center/manage${query}`);
}
