import { WebsiteShell } from "@/components/website/website-shell";

export default function MarketingWebLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WebsiteShell variant="marketing">{children}</WebsiteShell>;
}
