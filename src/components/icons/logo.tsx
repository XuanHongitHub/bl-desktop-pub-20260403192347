import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /**
   * "full"  — full BUG MEDIA logo (default), width scales with height
   * "icon"  — bug icon only, cropped from the left portion of the image
   *           using object-fit:cover + object-position:left so the bug
   *           fills the container and the text is clipped off to the right
   */
  variant?: "full" | "icon";
}

export const Logo = ({ className, variant = "full" }: LogoProps) => {
  if (variant === "icon") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/buglogin-logo.webp"
        alt="BugLogin"
        className={cn("object-cover object-left", className)}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/buglogin-logo.webp"
      alt="BugLogin"
      className={cn("h-auto w-auto object-contain", className)}
    />
  );
};
