'use client';

import type { ReactNode } from 'react';
import AdminPageHeader from '@/components/AdminPageHeader';
import { AdminShell } from '@/components/admin/admin-layout';

const AS_OF = '2026-07-16';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Note({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'info'; children: ReactNode }) {
  const cls =
    tone === 'ok'
      ? 'border-emerald-500/30 bg-emerald-500/10'
      : tone === 'warn'
        ? 'border-amber-500/30 bg-amber-500/10'
        : tone === 'bad'
          ? 'border-red-500/30 bg-red-500/10'
          : 'border-border bg-muted/40';
  return <div className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${cls}`}>{children}</div>;
}

export default function ProductScorecardPage() {
  return (
    <>
      <AdminShell>
        <AdminPageHeader
          title="Product scorecard (temp)"
          breadcrumbs={[
            { label: 'Admin', href: '/admin/dashboard' },
            { label: 'Product scorecard' },
          ]}
        />

        <div className="mx-auto max-w-5xl space-y-10 px-4 pb-16 pt-2">
          <p className="text-sm text-muted-foreground">
            Snapshot as of {AS_OF}. Static analysis from DB + admin git — not live. Delete this route when done.
          </p>

          <Note tone="warn">
            <strong>Overall:</strong> Ops/KYC/finance stack is strong and bookings started mid-June, but demand never
            spread past one provider. Signups and contact leads cooled after May. Eng commits skewed to wallet/Chapa while
            liquidity and conversion stayed weak.
          </Note>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat value="293" label="Customers" />
            <Stat value="452" label="Active providers" />
            <Stat value="47" label="Paid activations" />
            <Stat value="138" label="Bookings" />
            <Stat value="79" label="Services live" />
            <Stat value="~4.3k ETB" label="Tier upgrade revenue" />
            <Stat value="~611 ETB" label="Booking payments" />
            <Stat value="30" label="Contact messages" />
          </div>

          <Section title="Funnel">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat value="10.4%" label="Signup → paid" />
              <Stat value="63.8%" label="Paid → listed" />
              <Stat value="3.3%" label="Listed → booked" />
              <Stat value="17" label="Paid with 0 services" />
            </div>
            <p className="text-sm text-muted-foreground">
              452 active → 47 paid → 30 listed → <strong>1</strong> provider ever booked. 9/293 customers ever booked
              (3.1%).
            </p>
          </Section>

          <Section title="Achieved">
            <div className="space-y-2">
              <Note tone="ok">Bookings live from mid-June (84 Jun + 54 Jul MTD). Completions 9 → 16. Chapa payments work.</Note>
              <Note tone="ok">KYC: 529 document submissions, 423 approved / 98 rejected / 8 pending (315 providers).</Note>
              <Note tone="ok">Tier upgrades: 36 success (~4,348 ETB). Wallet ledger 362 txs. 26 bank payout methods.</Note>
              <Note tone="ok">Catalog: 7 categories, 42 subcats, 77/79 services approved. Admin team of 6.</Note>
            </div>
          </Section>

          <Section title="Lost / cooling">
            <div className="space-y-2">
              <Note tone="bad">Signups −57% customers / −53% providers vs prior 30 days after May spike.</Note>
              <Note tone="bad">Contacts: 22 May → 7 Jun → 1 Jul. Inbound pipeline dried up.</Note>
              <Note tone="warn">Empty shelves: Automotive, Business, Renovation inactive; Logistics active with 0 services. 28/42 subcats empty.</Note>
              <Note tone="warn">Push unused (0 notification rows; FCM on 20 customers / 28 providers). Coupon TEST0101 expired.</Note>
            </div>
          </Section>

          <Section title="Did well vs poorly">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-border p-4">
                <h3 className="font-medium text-emerald-700 dark:text-emerald-400">Good</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  <li>Verify docs throughput (~80% approve)</li>
                  <li>Service approval gate works</li>
                  <li>0 cancellations; 56% of bookers repeat</li>
                  <li>Money rails (activation, tiers, wallets)</li>
                </ul>
              </div>
              <div className="space-y-2 rounded-lg border border-border p-4">
                <h3 className="font-medium text-red-700 dark:text-red-400">Bad</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  <li>138/138 bookings → 1 provider only</li>
                  <li>70% bookings rejected (test noise)</li>
                  <li>Median booking ~2.78 ETB</li>
                  <li>35 job requests all pending, 0 paid</li>
                  <li>0 handyman assignments; ~0 reviews</li>
                </ul>
              </div>
            </div>
          </Section>

          <Section title="Categories">
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Subcats</th>
                    <th className="px-3 py-2 font-medium">Services</th>
                    <th className="px-3 py-2 font-medium">Avg price</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Maintenance', 'active', '8', '46', '1,509'],
                    ['Technical', 'active', '8', '17', '2,912'],
                    ['Domestic Help', 'active', '10', '16', '9,544'],
                    ['Logistics', 'active', '4', '0', '—'],
                    ['Automotive', 'inactive', '3', '0', '—'],
                    ['Business', 'inactive', '4', '0', '—'],
                    ['Renovation', 'inactive', '5', '0', '—'],
                  ].map((row) => (
                    <tr key={row[0]} className="border-b last:border-0">
                      {row.map((cell, i) => (
                        <td key={i} className="px-3 py-2">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Growth (monthly new records)">
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 font-medium">Month</th>
                    <th className="px-3 py-2 font-medium">Customers</th>
                    <th className="px-3 py-2 font-medium">Providers</th>
                    <th className="px-3 py-2 font-medium">Services</th>
                    <th className="px-3 py-2 font-medium">Bookings</th>
                    <th className="px-3 py-2 font-medium">Admin commits</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Mar', '1', '1', '0', '0', '24'],
                    ['May', '181', '247', '30', '0', '29'],
                    ['Jun', '93', '160', '41', '84', '51'],
                    ['Jul*', '18', '46', '8', '54', '12'],
                  ].map((row) => (
                    <tr key={row[0]} className="border-b last:border-0">
                      {row.map((cell, i) => (
                        <td key={i} className="px-3 py-2">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">Jul* = month to date. Booking status: 97 rejected · 25 completed · 10 on_the_way.</p>
          </Section>

          <Section title="Admin git (kena741/lolelink-admin)">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat value="173" label="Total commits" />
              <Stat value="42" label="Finance/wallet/Chapa commits" />
              <Stat value="9" label="Booking commits" />
              <Stat value="3" label="PRs all-time" />
            </div>
            <Note tone="ok">
              Create-booking (mid-Jun) lined up with bookings starting the same fortnight. May KYC/SMS matched supply spike.
            </Note>
            <Note tone="bad">
              Commit mix is ops-heavy (~42 finance vs ~9 bookings vs ~4 customers). Bottleneck is liquidity/conversion, not
              more wallet tooling. Marketing tracker landed after contact heat cooled. Job requests shipped Apr, still stuck.
            </Note>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Commit</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Jul 14', 'feat(bookings): validation + security'],
                    ['Jul 14', 'feat(bookings): status + address handling'],
                    ['Jul 13', 'feat(push): Firebase FCM'],
                    ['Jul 8', 'feat(marketing-tracker): sheet analytics'],
                    ['Jul 7', 'feat(payout): wallet analysis / reversals'],
                    ['Jul 7', 'feat(dashboard): revenue breakdown'],
                    ['Jul 2', 'feat(admin): mobile app config + company profile'],
                  ].map(([date, msg]) => (
                    <tr key={msg} className="border-b last:border-0">
                      <td className="px-3 py-2 whitespace-nowrap">{date}</td>
                      <td className="px-3 py-2">{msg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Priority actions">
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Spread demand across providers (unique providers booked / week).</li>
              <li>Restart inbound + convert the 30 contact leads (phone subjects = sales queue).</li>
              <li>Unstick 35 pending job requests or hide the feature.</li>
              <li>Hide empty categories; seed demand into Maintenance (46 services).</li>
              <li>Filter test/rejected bookings from KPIs.</li>
              <li>Next eng work: liquidity + conversion, not another wallet reconcile unless money breaks.</li>
            </ol>
          </Section>
        </div>
      </AdminShell>
    </>
  );
}
