import { AlertCircle, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export type AdminStateBannerKind =
  | "loading"
  | "refreshing"
  | "empty"
  | "error"
  | "permission"
  | "stale";

type AdminStateBannerProps = {
  kind: AdminStateBannerKind;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

function iconFor(kind: AdminStateBannerKind) {
  if (kind === "loading") return <Loader2 className="h-4 w-4 animate-spin" />;
  if (kind === "refreshing")
    return <RefreshCw className="h-4 w-4 animate-spin" />;
  if (kind === "permission") return <ShieldAlert className="h-4 w-4" />;
  return <AlertCircle className="h-4 w-4" />;
}

export function AdminStateBanner({
  kind,
  title,
  description,
  actionLabel,
  onAction,
}: AdminStateBannerProps) {
  return (
    <Alert variant={kind === "error" ? "destructive" : "default"}>
      {iconFor(kind)}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {description ? <p>{description}</p> : null}
        {actionLabel && onAction ? (
          <Button size="sm" variant="outline" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
