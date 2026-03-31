import localFont from "next/font/local";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import "@/app/globals.css";
import "flag-icons/css/flag-icons.min.css";
import { AppProviders } from "@/components/app-providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://buglogin.io"),
  title: {
    default: "BugLogin Antidetect Browser",
    template: "%s | BugLogin",
  },
  description:
    "BugLogin web portal for pricing, checkout, billing, account operations, and super admin control.",
  applicationName: "BugLogin",
};

const geistSans = localFont({
  src: [
    {
      path: "./fonts/Geist-Variable.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-geist-sans",
  display: "swap",
  preload: true,
  fallback: [],
  adjustFontFallback: false,
});

const geistMono = localFont({
  src: [
    {
      path: "./fonts/GeistMono-Variable.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-geist-mono",
  display: "swap",
  preload: true,
  fallback: [],
  adjustFontFallback: false,
});

const SUPPORTED_LAYOUT_LANGUAGES = new Set(["vi", "en"]);
const LANGUAGE_COOKIE_KEY = "buglogin_language";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const languageCookie = cookieStore.get(LANGUAGE_COOKIE_KEY)?.value ?? "vi";
  const htmlLanguage = SUPPORTED_LAYOUT_LANGUAGES.has(languageCookie)
    ? languageCookie
    : "vi";

  return (
    <html lang={htmlLanguage} suppressHydrationWarning>
      <body
        className={`${geistSans.className} ${geistSans.variable} ${geistMono.variable} min-h-screen bg-background antialiased`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
