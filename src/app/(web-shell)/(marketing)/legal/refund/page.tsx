import { PortalPageFrame } from "@/components/portal/portal-page-frame";

export default function RefundPage() {
  return (
    <PortalPageFrame
      title="Refund Policy"
      description="Billing adjustments and refund handling for BugLogin workspace subscriptions."
    >
      <div className="space-y-3 text-sm leading-7 text-muted-foreground">
        <p>
          Refund requests are reviewed against plan terms, usage period, and payment confirmation records.
        </p>
        <p>
          Contact support with workspace ID and transaction reference for expedited review.
        </p>
      </div>
    </PortalPageFrame>
  );
}
