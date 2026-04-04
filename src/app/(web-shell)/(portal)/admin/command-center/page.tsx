import { redirect } from "next/navigation";

export default function AdminCommandCenterRedirectPage() {
  redirect("/admin/dashboard");
}
