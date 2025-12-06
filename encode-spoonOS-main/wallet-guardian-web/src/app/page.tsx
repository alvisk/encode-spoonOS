import { AlertTriangle, BellRing, Radar, ShieldCheck, Zap } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
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

const severityBadge = (severity: string) => {
  switch (severity) {
    case "critical":
      return "bg-rose-300 border-2 border-black text-black shadow-[4px_4px_0_0_#0f172a]";
    case "high":
      return "bg-amber-200 border-2 border-black text-black shadow-[4px_4px_0_0_#0f172a]";
    case "medium":
      return "bg-sky-200 border-2 border-black text-black shadow-[4px_4px_0_0_#0f172a]";
    default:
      return "bg-emerald-200 border-2 border-black text-black shadow-[4px_4px_0_0_#0f172a]";
  }
};

const riskTone = (risk: number) => {
  if (risk >= 70) return "bg-rose-200";
  if (risk >= 40) return "bg-amber-200";
  return "bg-emerald-200";
};

export default function HomePage() {
  const primaryWallet = mockWallets[0];
  const activities = mockActivityByAddress[primaryWallet.address] ?? [];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 pb-16 pt-10">
      <section className="neo-hero neo-card border-black px-8 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-3">
            <Badge className="neo-pill bg-[#fef08a] text-black">Neo-brutalism</Badge>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
                Wallet Guardian UI sandbox
              </h1>
              <p className="mt-2 max-w-3xl text-lg font-medium text-slate-800">
                Mock APIs + shadcn primitives styled in a bold neo-brutalism palette.
                Swap the data layer later, keep the UI structure.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="border-2 border-black bg-white text-black shadow-[6px_6px_0_0_#0f172a] hover:-translate-y-0.5">
                <a href="/api/summary" target="_blank" rel="noreferrer">
                  View mock JSON
                </a>
              </Button>
              <Button
                variant="secondary"
                asChild
                className="border-2 border-black bg-[#c7d2fe] text-black shadow-[6px_6px_0_0_#0f172a] hover:-translate-y-0.5"
              >
                <a href="#ui">Jump to UI</a>
              </Button>
            </div>
          </div>
          <div className="neo-card flex flex-col gap-2 bg-white px-4 py-3 text-sm">
            <p className="font-bold text-slate-900">API endpoints</p>
            <Separator className="bg-black" />
            <ul className="space-y-2 font-mono text-xs text-slate-800">
              <li>GET /api/summary</li>
              <li>GET /api/wallets</li>
              <li>GET /api/wallets/[address]</li>
              <li>GET /api/wallets/[address]/activity</li>
              <li>GET /api/alerts</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="ui" className="grid gap-6 lg:grid-cols-4">
        <div className="col-span-3 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Total coverage",
                value: formatUSD(mockSummary.totalValueUSD),
                tone: "bg-[#fef08a]",
                icon: <ShieldCheck className="h-5 w-5" />,
              },
              {
                label: "Tx last 24h",
                value: mockSummary.dailyTx.toLocaleString(),
                tone: "bg-[#a5b4fc]",
                icon: <Zap className="h-5 w-5" />,
              },
              {
                label: "Open alerts",
                value: mockSummary.openAlerts,
                tone: "bg-[#fca5a5]",
                icon: <BellRing className="h-5 w-5" />,
              },
              {
                label: "High-risk wallets",
                value: mockSummary.highRiskWallets,
                tone: "bg-[#86efac]",
                icon: <Radar className="h-5 w-5" />,
              },
            ].map((stat) => (
              <Card
                key={stat.label}
                className={`neo-card ${stat.tone} border-black text-black`}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base font-semibold">{stat.label}</CardTitle>
                  {stat.icon}
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-black">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="neo-card border-black bg-white">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-black">Monitored wallets</CardTitle>
                <CardDescription className="text-slate-700">
                  Drill into balances, chains, and risk posture. Powered by
                  /api/wallets and /api/wallets/:address.
                </CardDescription>
              </div>
              <Badge className="neo-pill bg-[#c7d2fe] text-black">
                {mockSummary.anomalies24h} anomalies / 24h
              </Badge>
            </CardHeader>
            <CardContent className="overflow-hidden rounded-lg border-2 border-black bg-[#f8fafc]">
              <Table>
                <TableHeader className="bg-[#e0f2fe]">
                  <TableRow className="border-black">
                    <TableHead className="text-black">Label</TableHead>
                    <TableHead className="text-black">Address</TableHead>
                    <TableHead className="text-black">Balance</TableHead>
                    <TableHead className="text-black">Risk</TableHead>
                    <TableHead className="text-black">Chains</TableHead>
                    <TableHead className="text-black">Last active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockWallets.map((wallet) => (
                    <TableRow key={wallet.address} className="border-black">
                      <TableCell className="font-semibold text-slate-900">
                        {wallet.label}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-800">
                        {wallet.address}
                      </TableCell>
                      <TableCell className="text-slate-900">
                        {formatUSD(wallet.balanceUSD)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`neo-pill ${riskTone(wallet.riskScore)} px-2 py-1 text-xs`}
                        >
                          {wallet.riskScore}/100
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-800">
                        {wallet.chains.join(", ")}
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {new Intl.DateTimeFormat("en", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(wallet.lastActive))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="neo-card border-black bg-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black">Alerts inbox</CardTitle>
                <CardDescription className="text-slate-700">
                  /api/alerts — filter by severity & status client-side.
                </CardDescription>
              </div>
              <Badge className="neo-pill bg-[#fca5a5] text-black">
                {mockAlerts.length} open / recent
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {mockAlerts.map((alert) => (
                <Alert
                  key={alert.id}
                  className="neo-card border-black bg-[#fff7ed]"
                  variant="default"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <AlertTitle className="flex items-center gap-2 text-base font-black text-slate-900">
                        <AlertTriangle className="h-4 w-4" />
                        {alert.title}
                      </AlertTitle>
                      <p className="text-xs font-mono text-slate-700">
                        {alert.id} • {alert.walletAddress}
                      </p>
                    </div>
                    <Badge className={severityBadge(alert.severity)}>
                      {alert.severity}
                    </Badge>
                  </div>
                  <AlertDescription className="mt-2 text-slate-800">
                    {alert.description}
                  </AlertDescription>
                  <div className="mt-3 space-y-1 text-xs text-slate-700">
                    <p className="font-semibold">Action: {alert.action}</p>
                    <p className="uppercase tracking-wide">
                      {new Intl.DateTimeFormat("en", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(alert.createdAt))}{" "}
                      • Status: {alert.status}
                    </p>
                  </div>
                </Alert>
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="neo-card border-black bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-black">Latest activity</CardTitle>
              <CardDescription className="text-slate-700">
                /api/wallets/:address/activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[360px] pr-2">
                <div className="space-y-3">
                  {activities.map((tx) => (
                    <div
                      key={tx.hash}
                      className="neo-card border-black bg-[#e0f2fe] px-3 py-3 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{tx.type}</span>
                        <span className="text-xs font-semibold text-slate-800">
                          {tx.chain}
                        </span>
                      </div>
                      <p className="text-slate-900">
                        {tx.tokenSymbol} • {formatUSD(tx.amountUSD)}
                      </p>
                      {tx.riskFlag ? (
                        <p className="text-xs font-semibold text-amber-800">
                          Flag: {tx.riskFlag}
                        </p>
                      ) : null}
                      <p className="text-xs text-slate-700">
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
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="neo-card border-black bg-[#d1fae5]">
            <CardHeader>
              <CardTitle className="text-lg font-black text-slate-900">
                Suggested build path
              </CardTitle>
              <CardDescription className="text-slate-800">
                Swap mock APIs for real data when ready.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-900">
              <p>1) Scorecards from /api/summary.</p>
              <p>2) Wallet table with risk & chain filters.</p>
              <p>3) Alerts inbox with severity & status chips.</p>
              <p>4) Drilldown timelines from /wallets/:address/activity.</p>
              <p>5) Add CTA buttons (revoke / pause / escalate) per alert.</p>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}
