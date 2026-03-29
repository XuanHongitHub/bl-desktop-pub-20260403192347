import { WindowDragArea } from "@/components/window-drag-area";

export default function DesktopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <WindowDragArea />
      {children}
    </>
  );
}
