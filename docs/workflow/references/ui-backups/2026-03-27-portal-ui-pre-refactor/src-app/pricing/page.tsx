import { PortalShell } from '@/components/portal/portal-shell';
import { Button } from '@/components/ui/button';

const plans = [
  {
    name: 'Starter',
    price: '$29',
    limit: 'Up to 100 profiles',
    features: ['Local profile runtime', 'Basic team access', 'Standard support'],
  },
  {
    name: 'Scale',
    price: '$99',
    limit: 'Up to 1000 profiles',
    features: ['Advanced automation controls', 'Workspace governance', 'Priority support'],
  },
  {
    name: 'Custom',
    price: 'Contact',
    limit: '2000+ profiles',
    features: ['Dedicated infra advisory', 'SLA and audit workflows', 'Custom rollout support'],
  },
] as const;

export default function PricingPage() {
  return (
    <PortalShell>
      <section className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight">Pricing</h1>
          <p className="text-muted-foreground">Choose the right workspace capacity for your operation.</p>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.name} className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <p className="mt-2 text-3xl font-semibold">{plan.price}</p>
              <p className="mt-1 text-sm text-muted-foreground">{plan.limit}</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {plan.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              <Button type="button" className="mt-5 w-full">
                Select {plan.name}
              </Button>
            </article>
          ))}
        </div>
      </section>
    </PortalShell>
  );
}
