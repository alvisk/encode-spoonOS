import {
  mockActivityByAddress,
  mockAlerts,
  mockSummary,
  mockWallets,
} from "~/lib/mockData";

const formatUSD = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const riskColor = (risk: number) => {
  if (risk >= 70) return "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/50";
  if (risk >= 40) return "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/50";
  return "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40";
};

export default function HomePage() {
  const primaryWallet = mockWallets[0];
  const activities = mockActivityByAddress[primaryWallet.address] ?? [];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 pb-16 pt-10">
      <header className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-gradient-to-br from-slate-900 to-slate-950 p-8 shadow-xl shadow-indigo-900/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-300/80">
              Wallet Guardian
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-white sm:text-4xl">
              Real-time wallet monitoring & anomaly triage
            </h1>
            <p className="mt-2 max-w-3xl text-slate-300">
              Mock data + APIs you can hit immediately: wallet health, alerts, recent
              activity, and routing for per-wallet drill-downs.
            </p>
          </div>
          <div className="flex gap-3">
            <a
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-md shadow-white/30 transition hover:-translate-y-0.5 hover:shadow-lg"
              href="/api/summary"
              target="_blank"
            >
              View mock APIs
            </a>
            <a
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/90 transition hover:-translate-y-0.5 hover:border-indigo-400/60 hover:text-white"
              href="#ui"
            >
              Jump to UI
            </a>
          </div>
        </div>
      </header>

      <section id="ui" className="grid gap-6 lg:grid-cols-4">
        <div className="col-span-3 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total coverage", value: formatUSD(mockSummary.totalValueUSD) },
              { label: "Tx in last 24h", value: mockSummary.dailyTx.toLocaleString() },
              { label: "Open alerts", value: mockSummary.openAlerts },
              { label: "High-risk wallets", value: mockSummary.highRiskWallets },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {stat.label}
                </p>
                <p className="mt-1 text-2xl font-semibold text-white">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg shadow-indigo-900/20">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Monitored wallets</h2>
                <p className="text-sm text-slate-400">
                  Drill into balances, chains, and risk posture. APIs: /api/wallets, /api/wallets/:address
                </p>
              </div>
              <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-200 ring-1 ring-indigo-500/40">
                {mockSummary.anomalies24h} anomalies past 24h
              </span>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-white/5">
              <table className="w-full divide-y divide-white/5 text-sm">
                <thead className="bg-white/5 text-left text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-medium">Label</th>
                    <th className="px-4 py-3 font-medium">Address</th>
                    <th className="px-4 py-3 font-medium">Balance</th>
                    <th className="px-4 py-3 font-medium">Risk</th>
                    <th className="px-4 py-3 font-medium">Chains</th>
                    <th className="px-4 py-3 font-medium">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {mockWallets.map((wallet) => (
                    <tr
                      key={wallet.address}
                      className="divide-x divide-white/5 bg-white/2 odd:bg-white/5/10"
                    >
                      <td className="px-4 py-3 font-medium text-white">{wallet.label}</td>
                      <td className="px-4 py-3 text-slate-300">{wallet.address}</td>
                      <td className="px-4 py-3 text-slate-100">
                        {formatUSD(wallet.balanceUSD)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${riskColor(wallet.riskScore)}`}
                        >
                          {wallet.riskScore}/100
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-200">
                        {wallet.chains.join(", ")}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Intl.DateTimeFormat("en", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(wallet.lastActive))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg shadow-indigo-900/20">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Recent alerts</h2>
                <p className="text-sm text-slate-400">
                  API: /api/alerts (supports filtering by wallet on the client).
                </p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                {mockAlerts.length} open / recent
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {mockAlerts.map((alert) => (
                <article
                  key={alert.id}
                  className="rounded-xl border border-white/5 bg-white/5 p-4 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        {alert.id} • {alert.walletAddress}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-white">
                        {alert.title}
                      </h3>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${
                        alert.severity === "critical"
                          ? "bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/40"
                          : alert.severity === "high"
                            ? "bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/40"
                            : "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-500/30"
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-slate-200">{alert.description}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    Action: {alert.action}
                  </p>
                  <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">
                    {new Intl.DateTimeFormat("en", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(alert.createdAt))}{" "}
                    • Status: {alert.status}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg shadow-indigo-900/20">
            <h3 className="text-lg font-semibold text-white">Latest activity</h3>
            <p className="text-sm text-slate-400">
              Per-wallet drilldown API: /api/wallets/:address/activity
            </p>
            <div className="mt-4 space-y-3">
              {activities.map((tx) => (
                <div
                  key={tx.hash}
                  className="rounded-xl border border-white/5 bg-white/5 p-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{tx.type}</span>
                    <span className="text-xs text-slate-400">{tx.chain}</span>
                  </div>
                  <p className="text-slate-200">
                    {tx.tokenSymbol} • {formatUSD(tx.amountUSD)}
                  </p>
                  {tx.riskFlag ? (
                    <p className="text-xs text-amber-200">Flag: {tx.riskFlag}</p>
                  ) : null}
                  <p className="text-xs text-slate-500">
                    {new Intl.DateTimeFormat("en", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(tx.timestamp))}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-indigo-500/40 bg-indigo-500/5 p-5 text-sm text-indigo-100">
            <h4 className="text-base font-semibold text-white">Suggested UI flow</h4>
            <ul className="mt-2 space-y-2 text-indigo-100/90">
              <li>1) Global posture: use /api/summary to render scorecards.</li>
              <li>2) Wallet table: fetch /api/wallets and allow risk/chain filters.</li>
              <li>3) Alert inbox: call /api/alerts with severity + status chips.</li>
              <li>4) Drilldown: /api/wallets/:address + /activity for timelines.</li>
              <li>5) Actions: embed “revoke / pause / escalate” CTAs per alert.</li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}





