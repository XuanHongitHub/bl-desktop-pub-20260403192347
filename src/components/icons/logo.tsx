import { cn } from "@/lib/utils";

export const BUGLOGIN_LOGO_SRC = "/buglogin-logo.webp";
const BUGLOGIN_LOGO_WIDTH = 384;
const BUGLOGIN_LOGO_HEIGHT = 169;
const BUGLOGIN_LOGO_ICON_SIZE = 96;

interface LogoProps {
  className?: string;
  alt?: string;
  /**
   * "full"  — full BUG MEDIA logo (default), width scales with height
   * "icon"  — bug icon only, cropped from the left portion of the image
   *           using object-fit:cover + object-position:left so the bug
   *           fills the container and the text is clipped off to the right
   */
  variant?: "full" | "icon";
}

export const Logo = ({
  className,
  variant = "full",
  alt = "BugLogin",
}: LogoProps) => {
  if (variant === "icon") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={BUGLOGIN_LOGO_SRC}
        alt={alt}
        width={BUGLOGIN_LOGO_ICON_SIZE}
        height={BUGLOGIN_LOGO_ICON_SIZE}
        decoding="async"
        draggable={false}
        className={cn(
          "block aspect-square object-cover object-left",
          className,
        )}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BUGLOGIN_LOGO_SRC}
      alt={alt}
      width={BUGLOGIN_LOGO_WIDTH}
      height={BUGLOGIN_LOGO_HEIGHT}
      decoding="async"
      draggable={false}
      className={cn("block h-auto max-w-full w-auto object-contain", className)}
    />
  );
};
