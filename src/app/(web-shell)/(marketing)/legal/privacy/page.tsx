import { PortalPageFrame } from "@/components/portal/portal-page-frame";

export default function PrivacyPage() {
  return (
    <PortalPageFrame
      title="Privacy Policy"
      description="How BugLogin processes account data, workspace metadata, and automation telemetry."
    >
      <div className="space-y-3 text-sm leading-7 text-muted-foreground">
        <p>
          We only process data required for profile orchestration, billing verification, and operational support.
        </p>
        <p>
          Workspace owners can request export or deletion workflows in accordance with the service agreement.
        </p>
      </div>
    </PortalPageFrame>
  );
}
