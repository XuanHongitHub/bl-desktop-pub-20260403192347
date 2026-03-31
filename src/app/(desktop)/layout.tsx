import { DesktopRuntimeOnlyGuard } from "@/components/website/runtime-surface-guard";
import { WindowDragArea } from "@/components/window-drag-area";

export default function DesktopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DesktopRuntimeOnlyGuard>
      <WindowDragArea />
      {children}
    </DesktopRuntimeOnlyGuard>
  );
}
