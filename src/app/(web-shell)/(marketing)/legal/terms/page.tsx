import { PortalPageFrame } from "@/components/portal/portal-page-frame";

export default function TermsPage() {
  return (
    <PortalPageFrame
      title="Terms of Service"
      description="Contractual terms for using BugLogin browser runtime, workspace services, and billing routes."
    >
      <div className="space-y-3 text-sm leading-7 text-muted-foreground">
        <p>
          By using BugLogin, you agree to operate within applicable law and platform abuse policies.
        </p>
        <p>
          Workspace owners are responsible for member access, plan usage, and data handling under their account.
        </p>
      </div>
    </PortalPageFrame>
  );
}
