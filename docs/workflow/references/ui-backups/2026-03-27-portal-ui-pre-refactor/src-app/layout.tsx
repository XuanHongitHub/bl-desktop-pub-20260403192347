"use client";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { usePathname } from "next/navigation";
import "@/styles/globals.css";
import "flag-icons/css/flag-icons.min.css";
import { useEffect } from "react";
import { I18nProvider } from "@/components/i18n-provider";
import { CustomThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WindowDragArea } from "@/components/window-drag-area";
import { setupLogging } from "@/lib/logger";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const interSans = Inter({
  variable: "--font-inter-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  useEffect(() => {
    void setupLogging();
  }, []);

  const isPublicWebPortalRoute =
    pathname === "/" ||
    pathname === "/pricing" ||
    pathname === "/auth" ||
    pathname === "/help" ||
    pathname.startsWith("/legal");
  const isWebPortalRoute =
    isPublicWebPortalRoute ||
    pathname === "/checkout" ||
    pathname.startsWith("/checkout/") ||
    pathname === "/account" ||
    pathname.startsWith("/account/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/");
  const isStandaloneWebRoute =
    pathname === "/oauth-callback" ||
    pathname === "/checkout" ||
    pathname.startsWith("/checkout/") ||
    isWebPortalRoute;
  const shouldShowWindowDragArea = !isStandaloneWebRoute;
  const appShellMode = shouldShowWindowDragArea ? "desktop" : "web";
  const bodyOverflowClass = isWebPortalRoute ? "overflow-y-auto" : "overflow-hidden";

  return (
    <html lang="vi" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${interSans.variable} ${geistMono.variable} antialiased bg-background ${bodyOverflowClass}`}
        data-app-shell={appShellMode}
      >
        <I18nProvider>
          <CustomThemeProvider>
            {shouldShowWindowDragArea ? <WindowDragArea /> : null}
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster />
          </CustomThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
