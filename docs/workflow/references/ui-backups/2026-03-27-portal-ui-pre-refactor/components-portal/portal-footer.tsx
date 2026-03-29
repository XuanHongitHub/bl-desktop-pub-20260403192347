import Link from "next/link";

export function PortalFooter() {
  return (
    <footer className="bg-foreground text-background pt-24 pb-12 px-6 border-t-[16px] border-foreground">
      <div className="max-w-[1400px] mx-auto text-center">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 font-black text-4xl tracking-tighter uppercase mb-12"
        >
          <div className="bg-background text-foreground px-3 py-1 transform -skew-x-12">
            BUG
          </div>
          <span>LOGIN</span>
        </Link>
        <p className="text-background/50 font-black uppercase tracking-widest mb-16">
          Phá vỡ mọi giới hạn thuật toán. &copy; {new Date().getFullYear()} Bug Media.
        </p>
      </div>
    </footer>
  );
}
