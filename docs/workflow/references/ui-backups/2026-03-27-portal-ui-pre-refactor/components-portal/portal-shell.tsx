import type { ReactNode } from 'react';
import { LinearHeader } from './linear-header';
import { LinearLayout } from './linear-layout';
import { PortalFooter } from './portal-footer';

export function PortalShell({ children }: { children: ReactNode }) {
  return (
    <LinearLayout>
      <LinearHeader />
      <main className="mx-auto flex min-h-[calc(100vh-220px)] w-full max-w-6xl px-6 py-14 pt-28">
        <div className="w-full">{children}</div>
      </main>
      <PortalFooter />
    </LinearLayout>
  );
}
