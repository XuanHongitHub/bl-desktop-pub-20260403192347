import { cn } from "@/lib/utils";
import {
  type RippleButtonProps as ButtonProps,
  RippleButton as UIButton,
} from "./ui/ripple";
import { Spinner } from "./ui/spinner";

type Props = ButtonProps & {
  isLoading: boolean;
  "aria-label"?: string;
};
export const LoadingButton = ({ isLoading, className, ...props }: Props) => {
  return (
    <UIButton
      className={cn("inline-flex items-center justify-center gap-2", className)}
      {...props}
      disabled={props.disabled || isLoading}
    >
      {isLoading ? (
        <>
          <Spinner size="md" className="text-current" />
          <span className="sr-only">{props["aria-label"] ?? "Loading"}</span>
        </>
      ) : (
        props.children
      )}
    </UIButton>
  );
};
