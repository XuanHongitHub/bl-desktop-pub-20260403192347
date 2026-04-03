import { redirect } from "next/navigation";

export default function AdminWorkspaceCreateRoutePage() {
  redirect("/admin/workspaces/manage?mode=create");
}
