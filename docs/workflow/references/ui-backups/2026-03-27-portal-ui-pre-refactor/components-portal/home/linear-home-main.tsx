import Link from "next/link";

export function LinearHomeMain() {
  return (
    <main className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1120px] px-5">
        <div className="h-[132px] sm:h-[124px] lg:h-[200px]" />

        <section>
          <h1 className="max-w-[760px] text-[44px] font-semibold leading-[1] tracking-[-0.04em] md:text-[64px]">
            <span className="sm:hidden">
              The product
              <br />
              development
              <br />
              system for teams
              <br />
              and agents
            </span>
            <span className="hidden sm:inline">
              The product development
              <br />
              system for teams and agents
            </span>
          </h1>

          <div className="h-5 md:h-8" />

          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <p className="max-w-[600px] text-[17px] text-muted-foreground">
              Purpose-built for planning and building products. Designed for the
              AI era.
            </p>

            <Link
              href="/next"
              className="hidden items-center gap-3 text-[15px] text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
            >
              <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_22%,transparent)]" />
              <span className="font-medium">Issue tracking is dead</span>
              <span>
                linear.app/next{" "}
                <span className="text-muted-foreground/70">→</span>
              </span>
            </Link>
          </div>

          <div className="h-9 md:h-[70px]" />

          <div className="relative overflow-hidden rounded-[14px] border border-border bg-card">
            <div className="absolute inset-0 opacity-95">
              <img
                src="https://linear.app/cdn-cgi/imagedelivery/fO02fVwohEs9s9UHFwon6A/c7b144b7-4ef0-4991-9bcb-617c6a37d200/f=auto,dpr=2,q=95,fit=scale-down,metadata=none"
                alt=""
                className="h-full w-full object-cover opacity-10"
                loading="lazy"
              />
            </div>

            <div className="relative aspect-[16/9]">
              <img
                src="https://linear.app/cdn-cgi/imagedelivery/fO02fVwohEs9s9UHFwon6A/c7b144b7-4ef0-4991-9bcb-617c6a37d200/f=auto,dpr=2,q=95,fit=scale-down,metadata=none"
                alt="A screenshot of the Linear app showing the issue that's currently in progress"
                className="h-full w-full object-cover"
                loading="eager"
              />
            </div>

            <img
              src="https://linear.app/cdn-cgi/imagedelivery/fO02fVwohEs9s9UHFwon6A/6600ca96-e49b-4fd9-c03a-7979faddad00/f=auto,dpr=2,q=95,fit=scale-down,metadata=none"
              alt=""
              className="pointer-events-none absolute inset-x-0 -bottom-8 hidden w-full opacity-95 md:block"
              loading="lazy"
            />
            <img
              src="https://linear.app/cdn-cgi/imagedelivery/fO02fVwohEs9s9UHFwon6A/c7fa8f5f-d439-4329-6a65-de549b51e300/f=auto,dpr=2,q=95,fit=scale-down,metadata=none"
              alt=""
              className="pointer-events-none absolute inset-x-0 -bottom-6 hidden w-full opacity-85 md:block"
              loading="lazy"
            />
          </div>

          <div className="h-16" />
        </section>
      </div>
    </main>
  );
}
