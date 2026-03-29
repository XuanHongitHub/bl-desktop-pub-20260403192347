export default function WebStandaloneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-y-auto bg-background text-foreground">
      {children}
    </div>
  );
}
