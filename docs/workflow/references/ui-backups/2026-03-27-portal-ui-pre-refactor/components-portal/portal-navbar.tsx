import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PortalNavbar() {
  return (
    <div id="buglogin-portal-navbar" className="fixed top-0 w-full z-[100000] bg-[#08090a]/80 backdrop-blur-md border-b border-white/10 h-[60px] flex items-center transition-colors">
      <div className="max-w-[1200px] mx-auto px-6 w-full flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-lg tracking-tight text-white transition-opacity hover:opacity-80"
          >
            {/* Minimal Logo */}
            <div className="w-5 h-5 rounded-[4px] bg-white text-black flex items-center justify-center font-bold text-[10px]">
              B
            </div>
            <span>BugLogin</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-[14px] font-medium text-white/60">
            <Link href="/" className="hover:text-white transition-colors">
              Browser
            </Link>
            <Link href="/pricing" className="hover:text-white transition-colors">
              Profile
            </Link>
            <Link href="/account" className="hover:text-white transition-colors">
              Proxy
            </Link>
            <Link href="/admin" className="hover:text-white transition-colors">
              Antidetect
            </Link>
            <Link href="/pricing" className="hover:text-white transition-colors">
              Billing
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Link 
            href="/auth" 
            className="hidden md:block text-[14px] font-medium text-white/60 hover:text-white transition-colors"
          >
            Auth
          </Link>
          <Button 
            asChild 
            variant="default" 
            className="h-8 px-4 rounded-full bg-white text-black hover:bg-white/90 font-medium text-[13px] shadow-[0_0_12px_rgba(255,255,255,0.1)] transition-all"
          >
            <Link href="/checkout">
              Checkout <ChevronRight className="w-3.5 h-3.5 ml-1 opacity-70" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
