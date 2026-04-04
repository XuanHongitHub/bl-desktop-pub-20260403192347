import { WebRuntimeOnlyGuard } from "@/components/website/runtime-surface-guard";

export default function WebStandaloneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WebRuntimeOnlyGuard>
      <div className="min-h-screen overflow-y-auto bg-background text-foreground">
        {children}
      </div>
    </WebRuntimeOnlyGuard>
  );
}
