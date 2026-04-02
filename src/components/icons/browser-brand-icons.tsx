import type { SVGProps } from "react";

type BrowserGlyphProps = SVGProps<SVGSVGElement>;

function IconShell({
  title,
  children,
  ...props
}: BrowserGlyphProps & { title: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={24}
      height={24}
      role="img"
      aria-label={title}
      {...props}
    >
      <title>{title}</title>
      <rect
        x="2.75"
        y="2.75"
        width="18.5"
        height="18.5"
        rx="6"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <rect
        x="2.75"
        y="2.75"
        width="18.5"
        height="18.5"
        rx="6"
        stroke="currentColor"
        strokeOpacity="0.22"
      />
      {children}
    </svg>
  );
}

export function BugFirefoxBrowserIcon(props: BrowserGlyphProps) {
  return (
    <IconShell title="Bug Firefox Browser" {...props}>
      <path
        d="M11.95 7.1c1.9 1.4 3 3.2 3 5.1a3.65 3.65 0 0 1-3.72 3.7 3.52 3.52 0 0 1-3.55-3.42c0-1.4.68-2.62 1.84-3.76.2 1.05.78 1.86 1.58 2.27.02-1.44.36-2.52.85-3.9Z"
        fill="currentColor"
        fillOpacity="0.28"
      />
      <path d="M12 7.2c1.95 1.4 2.95 3.16 2.95 5a3.58 3.58 0 0 1-3.67 3.67A3.46 3.46 0 0 1 7.8 12.5" />
    </IconShell>
  );
}

export function BugFirefoxDeveloperBrowserIcon(props: BrowserGlyphProps) {
  return (
    <IconShell title="Bug Firefox Developer Browser" {...props}>
      <path
        d="M11.95 7.1c1.9 1.4 3 3.2 3 5.1a3.65 3.65 0 0 1-3.72 3.7 3.52 3.52 0 0 1-3.55-3.42c0-1.4.68-2.62 1.84-3.76.2 1.05.78 1.86 1.58 2.27.02-1.44.36-2.52.85-3.9Z"
        fill="currentColor"
        fillOpacity="0.28"
      />
      <path d="M12 7.2c1.95 1.4 2.95 3.16 2.95 5a3.58 3.58 0 0 1-3.67 3.67A3.46 3.46 0 0 1 7.8 12.5" />
      <path d="m16.25 6.75.52 1.06 1.13.17-.82.8.2 1.12-1.03-.54-1.02.54.2-1.12-.83-.8 1.14-.17.5-1.06Z" />
    </IconShell>
  );
}

export function BugChromiumBrowserIcon(props: BrowserGlyphProps) {
  return (
    <IconShell title="Bug Chromium Browser" {...props}>
      <path
        d="m12 7.35 3.9 2.25v4.8L12 16.65 8.1 14.4V9.6L12 7.35Z"
        fill="currentColor"
        fillOpacity="0.18"
      />
      <path d="m12 7.35 3.9 2.25v4.8L12 16.65 8.1 14.4V9.6L12 7.35Z" />
      <circle cx="12" cy="12" r="2.15" fill="currentColor" fillOpacity="0.35" />
      <path d="M8.1 9.6h7.8M8.1 14.4l3.9-2.4 3.9 2.4" />
    </IconShell>
  );
}

export function BugBraveBrowserIcon(props: BrowserGlyphProps) {
  return (
    <IconShell title="Bug Brave Browser" {...props}>
      <path
        d="m12 7.05 4.05 1.55v3.85c0 2.33-1.52 3.96-4.05 4.88-2.53-.92-4.05-2.55-4.05-4.88V8.6L12 7.05Z"
        fill="currentColor"
        fillOpacity="0.18"
      />
      <path d="m12 7.05 4.05 1.55v3.85c0 2.33-1.52 3.96-4.05 4.88-2.53-.92-4.05-2.55-4.05-4.88V8.6L12 7.05Z" />
      <path d="M10.2 10.15h2.2c.9 0 1.45.42 1.45 1.08 0 .45-.22.78-.67.95.65.2 1.02.66 1.02 1.33 0 .9-.68 1.48-1.86 1.48H10.2v-4.84Z" />
      <path d="M11.3 11.12v.97h1.05c.36 0 .57-.18.57-.5 0-.3-.2-.47-.57-.47H11.3Zm0 1.9v1.03h1.22c.38 0 .6-.2.6-.52 0-.34-.22-.5-.6-.5H11.3Z" />
    </IconShell>
  );
}

export function BugZenBrowserIcon(props: BrowserGlyphProps) {
  return (
    <IconShell title="Bug Zen Browser" {...props}>
      <circle cx="12" cy="12" r="4.65" />
      <path d="M8 12h8" />
      <path d="M7.2 9.2a6.4 6.4 0 1 1 .02 5.64" />
    </IconShell>
  );
}

export function BugCamoufoxBrowserIcon(props: BrowserGlyphProps) {
  return (
    <IconShell title="Bugox Browser" {...props}>
      <path d="m9.1 9.2 1.1-2.1 1.1 1.6M14.9 9.2l-1.1-2.1-1.1 1.6" />
      <path
        d="M8.15 13.2c.7 1.85 2.12 2.95 3.86 2.95 2.08 0 3.67-1.35 4.14-3.4-.7.55-1.58.87-2.54.87-1.06 0-2.03-.38-2.8-1.06a3.93 3.93 0 0 1-2.66.64Z"
        fill="currentColor"
        fillOpacity="0.2"
      />
      <path d="M8.05 13.35c.8 1.75 2.26 2.8 3.96 2.8 2.08 0 3.65-1.33 4.13-3.33M9.9 10.8c.53-.6 1.2-.92 1.98-.92.85 0 1.56.36 2.13 1.02" />
    </IconShell>
  );
}

export function BugWayfernBrowserIcon(props: BrowserGlyphProps) {
  return (
    <IconShell title="Bugium Browser" {...props}>
      <path d="m7.4 9.2 1.75 5.25 2.85-3.72 2.85 3.72 1.75-5.25" />
      <path d="M8.25 16.2c1.1.45 2.37.7 3.75.7s2.65-.25 3.75-.7" />
    </IconShell>
  );
}

export function BugUnknownBrowserIcon(props: BrowserGlyphProps) {
  return (
    <IconShell title="Bug Browser" {...props}>
      <path d="M9.35 10.1a2.9 2.9 0 1 1 4.75 2.2c-.63.56-1.05.95-1.05 1.65" />
      <circle cx="12" cy="15.9" r="0.35" fill="currentColor" />
      <path d="M7.5 8.2h9" />
    </IconShell>
  );
}
