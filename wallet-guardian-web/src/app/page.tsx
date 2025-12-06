"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BellRing, Radar, ShieldCheck, Zap, Bot, CreditCard } from "lucide-react";
import { PaymentFlow } from "~/components/PaymentFlow";
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

// SpoonOS API endpoint
const SPOONOS_API_URL = "https://encode-spoonos-production.up.railway.app";

type Wallet = (typeof mockWallets)[number];
type Activity = NonNullable<(typeof mockActivityByAddress)[string]>[number];

// SpoonOS API response type
type SpoonOSAnalysis = {
  result: string;
  payer?: string;
};

// x402 payment requirements type
type X402Requirements = {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  payTo: string;
  asset: string;
  extra?: {
    name?: string;
    decimals?: number;
    currency?: string;
  };
};

type NeoLineInstance = {
  EVENT: { ACCOUNT_CHANGED: string };
  getAccount: () => Promise<{ address: string }>;
  addEventListener: (
    event: string,
    cb: (data: { address?: string }) => void,
  ) => void;
};

type NeoLineGlobal = {
  Init: new () => NeoLineInstance;
};

const formatUSD = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

// BRUTALIST SEVERITY COLORS - Industrial strength
const severityBadge = (severity: string) => {
  switch (severity) {
    case "critical":
      return "bg-[#FF0000] text-white font-black";
    case "high":
      return "bg-[#FFFF00] text-black font-black";
    case "medium":
      return "bg-[#00BFFF] text-black font-black";
    default:
      return "bg-[#00FF00] text-black font-black";
  }
};

const severitySurface = (severity: string) => {
  switch (severity) {
    case "critical":
      return "bg-[#FFE5E5] alert-critical";
    case "high":
      return "bg-[#FFFDE7]";
    case "medium":
      return "bg-[#E3F2FD]";
    default:
      return "bg-[#E8F5E9]";
  }
};

const statusBadge = (status: string) => {
  switch (status) {
    case "investigating":
      return "bg-[#FFFF00] text-black font-black";
    case "open":
      return "bg-white text-black border-4 border-black font-black";
    default:
      return "bg-black text-white font-black";
  }
};

const riskTone = (risk: number) => {
  if (risk >= 70) return "bg-[#FF0000] text-white";
  if (risk >= 40) return "bg-[#FFFF00] text-black";
  return "bg-[#00FF00] text-black";
};

const DEFAULT_WALLET: Wallet = {
  address: "",
  label: "Demo wallet",
  balanceUSD: 0,
  riskScore: 0,
  chains: ["Neo N3"],
  lastActive: new Date().toISOString(),
  tags: [],
};

export default function HomePage() {
  const primaryWallet = mockWallets[0] ?? DEFAULT_WALLET;
  const activities = mockActivityByAddress[primaryWallet.address] ?? [];

  const [scanAddress, setScanAddress] = useState("");
  const [scanStatus, setScanStatus] = useState<
    "idle" | "loading" | "error" | "done" | "payment_required"
  >("idle");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanWallet, setScanWallet] = useState<Wallet | null>(null);
  const [scanActivity, setScanActivity] = useState<Activity[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<SpoonOSAnalysis | null>(null);
  const [usePaywalled, setUsePaywalled] = useState(true); // Default to x402 paywalled endpoint
  const [x402Requirements, setX402Requirements] = useState<X402Requirements | null>(null);
  const [paymentHeader, setPaymentHeader] = useState("");

  const scanAlerts = useMemo(
    () =>
      scanWallet
        ? mockAlerts.filter((a) => a.walletAddress === scanWallet.address)
        : [],
    [scanWallet],
  );

  // Connect to NeoLine dAPI once the provider signals READY.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const getNeoLineGlobals = () => {
      const globalWithNeo = window as typeof window & {
        NEOLine?: NeoLineGlobal;
        NEOLineN3?: NeoLineGlobal;
      };
      return {
        neoLine: globalWithNeo.NEOLine,
        neoLineN3: globalWithNeo.NEOLineN3,
      };
    };

    const handleReady = () => {
      try {
        const { neoLine, neoLineN3 } = getNeoLineGlobals();
        if (!neoLine || !neoLineN3) {
          console.warn("NeoLine providers not detected");
          return;
        }

        // Instantiate both Neo2 and N3 providers; use N3 for address here.
        const neoline = new neoLine.Init();
        const neolineN3 = new neoLineN3.Init();
        void neoline; // Neo2 instance kept for future calls/events

        const syncAccount = ({ address }: { address?: string }) => {
          if (address) setScanAddress(address);
        };

        neolineN3
          .getAccount()
          .then(syncAccount)
          .catch((err: unknown) => console.error("getAccount failed", err));

        neolineN3.addEventListener(
          neolineN3.EVENT.ACCOUNT_CHANGED,
          syncAccount,
        );
      } catch (err) {
        console.error("NeoLine init failed", err);
      }
    };

    window.addEventListener("NEOLine.NEO.EVENT.READY", handleReady);
    return () => {
      window.removeEventListener("NEOLine.NEO.EVENT.READY", handleReady);
    };
  }, []);

  const runSelfScan = async (overridePaymentHeader?: string) => {
    if (!scanAddress.trim()) return;
    setScanStatus("loading");
    setScanError(null);
    setAiAnalysis(null);
    
    // Use override payment header if provided, otherwise use state
    const effectivePaymentHeader: string = typeof overridePaymentHeader === "string" 
      ? overridePaymentHeader 
      : (typeof paymentHeader === "string" ? paymentHeader : "");
    
    // Don't reset x402Requirements if we have a payment header (retry scenario)
    if (!effectivePaymentHeader || effectivePaymentHeader.length === 0) {
      setX402Requirements(null);
    }
    
    try {
      let spoonRes: Response;
      
      if (usePaywalled) {
        // Use the x402 paywalled endpoint
        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };
        
        // Add payment header if provided
        if (effectivePaymentHeader && effectivePaymentHeader.length > 0) {
          headers["X-PAYMENT"] = effectivePaymentHeader;
          console.log("[x402] Sending payment header:", effectivePaymentHeader.substring(0, 50) + "...");
        } else {
          console.log("[x402] No payment header, initial request");
        }
        
        console.log("[x402] Making request to:", `${SPOONOS_API_URL}/x402/invoke/wallet-guardian`);
        
        spoonRes = await fetch(
          `${SPOONOS_API_URL}/x402/invoke/wallet-guardian`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              prompt: `analyze wallet ${scanAddress.trim()}`,
            }),
          }
        );
        
        console.log("[x402] Response status:", spoonRes.status);
        
        // Handle 402 Payment Required
        if (spoonRes.status === 402) {
          // If we already sent a payment header and still got 402, the payment was rejected
          if (effectivePaymentHeader && effectivePaymentHeader.length > 0) {
            const errorData = await spoonRes.json() as { error?: string; payer?: string };
            console.error("[x402] Payment rejected:", errorData);
            setScanError(`Payment rejected: ${errorData.error ?? "Unknown error"}`);
            setPaymentHeader(""); // Clear the invalid payment header
            setScanStatus("error");
            return;
          }
          
          const paymentData = await spoonRes.json() as { accepts?: X402Requirements[] };
          if (paymentData.accepts && paymentData.accepts.length > 0) {
            setX402Requirements(paymentData.accepts[0] ?? null);
          }
          setScanStatus("payment_required");
          return;
        }
      } else {
        // Use the free endpoint
        const prompt = encodeURIComponent(`analyze wallet ${scanAddress.trim()}`);
        spoonRes = await fetch(
          `${SPOONOS_API_URL}/analyze?prompt=${prompt}`,
          { method: "POST" }
        );
      }

      if (!spoonRes.ok) {
        const err = (await spoonRes.json().catch(() => ({}))) as {
          detail?: string;
        };
        throw new Error(err.detail ?? "SpoonOS API error");
      }

      const spoonData = (await spoonRes.json()) as SpoonOSAnalysis;
      setAiAnalysis(spoonData);

      // Also fetch local wallet data for display
      const encoded = encodeURIComponent(scanAddress.trim());
      const [walletRes, activityRes] = await Promise.all([
        fetch(`/api/wallets/${encoded}`),
        fetch(`/api/wallets/${encoded}/activity`),
      ]);

      if (walletRes.ok) {
        const walletJson: unknown = await walletRes.json();
        const walletData = walletJson as Wallet;
        setScanWallet(walletData);
      } else {
        // Create a minimal wallet object from the address
        setScanWallet({
          address: scanAddress.trim(),
          label: "Scanned Wallet",
          balanceUSD: 0,
          riskScore: 50,
          chains: ["Neo N3"],
          lastActive: new Date().toISOString(),
          tags: [],
        });
      }

      if (activityRes.ok) {
        const activityJson: unknown = await activityRes.json();
        setScanActivity((activityJson as Activity[]) ?? []);
      } else {
        setScanActivity([]);
      }

      setScanStatus("done");
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Unexpected error");
      setScanStatus("error");
    }
  };

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-10 px-6 pt-12 pb-20">
      {/* HERO SECTION - Industrial Command Center */}
      <section className="neo-hero neo-card border-black px-10 py-14 relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-6 relative z-10">
          <div className="space-y-6">
            <div>
              <h1 className="text-5xl font-black tracking-[0.2em] text-black uppercase sm:text-7xl lg:text-8xl xl:text-9xl">
                ASSERTION OS
              </h1>
              <div className="mt-4 h-2 w-32 bg-black" />
              <p className="mt-6 max-w-2xl text-lg font-bold text-black uppercase tracking-wide">
                Industrial-grade Neo N3 wallet security. Monitor. Detect. Assert.
              </p>
              <p className="mt-2 max-w-2xl text-sm font-medium text-black/70">
                A SpoonOS agent that analyzes wallets, surfaces risks, and generates actionable alerts.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Button
                asChild
                className="neo-button border-4 border-black bg-white text-black shadow-[8px_8px_0_0_#000] transition-none hover:translate-x-1 hover:translate-y-1 hover:shadow-[4px_4px_0_0_#000] active:translate-x-2 active:translate-y-2 active:shadow-none uppercase tracking-wider font-bold"
              >
                <a href="/api/summary" target="_blank" rel="noreferrer">
                  View API
                </a>
              </Button>
              <Button
                variant="secondary"
                asChild
                className="neo-button border-4 border-black bg-[#FFFF00] text-black shadow-[8px_8px_0_0_#000] transition-none hover:translate-x-1 hover:translate-y-1 hover:shadow-[4px_4px_0_0_#000] active:translate-x-2 active:translate-y-2 active:shadow-none uppercase tracking-wider font-bold"
              >
                <a href="#ui">Command Center</a>
              </Button>
            </div>
          </div>
          <div className="neo-card flex flex-col gap-3 bg-black text-white px-6 py-5 text-sm border-4 border-black shadow-[8px_8px_0_0_#FFFF00]">
            <p className="font-black uppercase tracking-widest text-[#FFFF00]">{"//"} API ENDPOINTS</p>
            <Separator className="bg-white/30" />
            <ul className="space-y-2 font-mono text-xs text-white/90">
              <li className="flex items-center gap-2"><span className="text-[#00FF00]">GET</span> /api/summary</li>
              <li className="flex items-center gap-2"><span className="text-[#00FF00]">GET</span> /api/wallets</li>
              <li className="flex items-center gap-2"><span className="text-[#00FF00]">GET</span> /api/wallets/[address]</li>
              <li className="flex items-center gap-2"><span className="text-[#00FF00]">GET</span> /api/wallets/[address]/activity</li>
              <li className="flex items-center gap-2"><span className="text-[#00FF00]">GET</span> /api/alerts</li>
            </ul>
          </div>
        </div>
      </section>

      {/* SCANNER SECTION */}
      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="neo-card border-black bg-white lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-4 border-b-4 border-black pb-6">
            <div>
              <CardTitle className="text-2xl font-black uppercase tracking-wide">
                Wallet Scanner
              </CardTitle>
              <CardDescription className="text-black/70 font-medium mt-1">
                Input a Neo N3 address for instant security analysis.
              </CardDescription>
            </div>
            <Badge className="neo-pill bg-[#FFFF00] text-black border-4 border-black shadow-[6px_6px_0_0_#000] font-black uppercase">Beta</Badge>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex flex-col gap-3">
              <label
                className="text-sm font-black text-black uppercase tracking-wider"
                htmlFor="scan"
              >
                Target Address
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="scan"
                  value={scanAddress}
                  onChange={(e) => setScanAddress(e.target.value)}
                  placeholder="Enter Neo N3 address..."
                  className="neo-input w-full border-4 border-black px-4 py-3 font-mono text-sm shadow-[6px_6px_0_0_#000] focus:outline-none focus:shadow-[4px_4px_0_0_#000] focus:translate-x-0.5 focus:translate-y-0.5 transition-none"
                />
                <Button
                  onClick={() => void runSelfScan()}
                  disabled={scanStatus === "loading" || !scanAddress.trim()}
                  className="neo-button border-4 border-black bg-[#00FF00] text-black shadow-[6px_6px_0_0_#000] transition-none hover:translate-x-1 hover:translate-y-1 hover:shadow-[3px_3px_0_0_#000] active:translate-x-2 active:translate-y-2 active:shadow-none uppercase tracking-wider font-black px-8 disabled:opacity-50"
                >
                  {scanStatus === "loading" ? "SCANNING..." : "SCAN"}
                </Button>
              </div>
              {scanError ? (
                <p className="text-sm font-black text-[#FF0000] uppercase tracking-wide">
                  ERROR: {scanError}
                </p>
              ) : null}
            </div>

            {/* PAYWALLED ENDPOINT TOGGLE */}
            <div className="flex flex-col gap-4 p-5 border-4 border-black bg-[#1a1a2e] shadow-[6px_6px_0_0_#FFFF00]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#FFFF00] rounded border-2 border-black">
                    <CreditCard className="h-5 w-5 text-black" strokeWidth={3} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-[#FFFF00] uppercase tracking-wider">
                      x402 Paywalled Mode
                    </p>
                    <p className="text-xs text-white/60">
                      Use the monetized endpoint (0.01 USDC/call on Base Sepolia)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setUsePaywalled(!usePaywalled)}
                  className={`relative w-14 h-8 rounded-none border-4 border-black transition-colors ${
                    usePaywalled ? 'bg-[#00FF00]' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-black transition-transform ${
                      usePaywalled ? 'left-7' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
              
              {usePaywalled && scanStatus !== "payment_required" && (
                <div className="pt-3 border-t border-white/20">
                  <p className="text-xs text-white/50">
                    When you scan a wallet, you&apos;ll be prompted to pay with your connected wallet.
                  </p>
                </div>
              )}
            </div>

            {/* PAYMENT REQUIRED STATE - Click-through wallet payment flow */}
            {scanStatus === "payment_required" && x402Requirements && (
              <PaymentFlow
                requirements={x402Requirements}
                onPaymentComplete={(signedPaymentHeader) => {
                  // After user signs authorization, set the x402 payment header and retry
                  setPaymentHeader(signedPaymentHeader);
                  console.log("[x402] Payment complete, retrying with header length:", signedPaymentHeader.length);
                  // Pass payment header directly to avoid React state timing issues
                  void runSelfScan(signedPaymentHeader);
                }}
                onCancel={() => {
                  setScanStatus("idle");
                  setX402Requirements(null);
                  setUsePaywalled(false);
                }}
              />
            )}

            {scanWallet ? (
              <>
                {/* AI ANALYSIS CARD - SpoonOS Response */}
                {aiAnalysis ? (
                  <div className="neo-card border-4 border-black bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-6 text-white">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-[#FFFF00] rounded border-2 border-black">
                        <Bot className="h-6 w-6 text-black" strokeWidth={3} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-[#FFFF00] uppercase tracking-widest">
                          {"//"} SPOONOS AI ANALYSIS
                        </p>
                        <p className="text-xs text-white/60 font-mono">
                          Agent: wallet-guardian
                        </p>
                      </div>
                      <Badge className="ml-auto neo-pill bg-[#00FF00] text-black border-2 border-black shadow-[3px_3px_0_0_#FFFF00] font-black uppercase text-xs">
                        Live
                      </Badge>
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-white/90 font-medium">
                        {aiAnalysis.result}
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/20">
                      <p className="text-xs text-white/50 font-mono">
                        Powered by SpoonOS x402 Gateway • Neo N3 Blockchain
                        {aiAnalysis.payer && (
                          <span className="block mt-1">
                            Paid by: {aiAnalysis.payer.slice(0, 6)}...{aiAnalysis.payer.slice(-4)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* WALLET INFO CARD */}
                  <div className="neo-card border-4 border-black bg-white p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <p className="text-xs font-black text-black uppercase tracking-widest">
                          {"//"} ADDRESS
                        </p>
                        <p className="font-mono text-sm break-all text-black">
                          {scanWallet.address}
                        </p>
                      </div>
                      <Badge className={`neo-pill ${riskTone(scanWallet.riskScore)} border-4 border-black shadow-[4px_4px_0_0_#000] font-black`}>
                        {scanWallet.riskScore}/100
                      </Badge>
                    </div>
                    <div className="mt-4 pt-4 border-t-2 border-black">
                      <p className="text-sm font-bold text-black">
                        {scanWallet.label ?? "UNKNOWN WALLET"} 
                      </p>
                      <p className="text-xs text-black/70 uppercase tracking-wide">
                        Chains: {scanWallet.chains?.join(", ") || "Neo N3"}
                      </p>
                      <p className="text-2xl font-black text-black mt-2">
                        {formatUSD(scanWallet.balanceUSD || 0)}
                      </p>
                    </div>
                    {scanWallet.tags?.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {scanWallet.tags.map((tag) => (
                          <span
                            key={tag}
                            className="neo-pill border-3 border-black bg-[#E5E5E5] px-3 py-1 text-xs font-black text-black uppercase shadow-[4px_4px_0_0_#000]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {/* ACTIVITY CARD */}
                  <div className="neo-card border-4 border-black bg-[#E3F2FD] p-5">
                    <p className="text-xs font-black text-black uppercase tracking-widest">
                      {"//"} RECENT ACTIVITY
                    </p>
                    <div className="mt-4 flex flex-col gap-3">
                      {scanActivity.length === 0 ? (
                        <p className="text-sm font-bold text-black/70 uppercase">
                          No transfers recorded.
                        </p>
                      ) : (
                        scanActivity.slice(0, 4).map((tx) => (
                          <div
                            key={tx.id ?? tx.hash}
                            className="flex items-center justify-between border-4 border-black bg-white px-4 py-3 shadow-[4px_4px_0_0_#000]"
                          >
                            <div>
                              <p className="text-sm font-black text-black uppercase">
                                {tx.type} • {tx.tokenSymbol}
                              </p>
                              <p className="text-xs font-mono text-black/60 truncate max-w-[150px]">
                                {tx.hash}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-black uppercase">{tx.chain}</p>
                              <p className="text-sm font-black text-black">{formatUSD(tx.amountUSD)}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* ALERTS CARD */}
                <div className={`neo-card border-4 border-black p-5 ${scanAlerts.some(a => a.severity === 'critical') ? 'alert-critical bg-[#FFE5E5]' : 'bg-[#FFF8E1]'}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-black uppercase tracking-widest">
                      {"//"} THREAT ANALYSIS
                    </p>
                    <Badge className={`neo-pill ${scanAlerts.length > 0 ? 'bg-[#FF0000] text-white' : 'bg-[#00FF00] text-black'} border-4 border-black shadow-[4px_4px_0_0_#000] font-black uppercase`}>
                      {scanAlerts.length} {scanAlerts.length === 1 ? 'Alert' : 'Alerts'}
                    </Badge>
                  </div>
                  <div className="mt-4 space-y-3">
                    {scanAlerts.length === 0 ? (
                      <p className="text-sm font-bold text-black/70 uppercase">
                        No active threats detected.
                      </p>
                    ) : (
                      scanAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className="border-4 border-black bg-white px-4 py-3 shadow-[4px_4px_0_0_#000]"
                        >
                          <p className="text-sm font-black text-black uppercase">
                            {alert.title}
                          </p>
                          <p className="text-xs text-black/70 mt-1">
                            {alert.description}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span
                              className={`neo-pill ${severityBadge(alert.severity)} border-3 border-black px-3 py-1 text-xs uppercase shadow-[3px_3px_0_0_#000]`}
                            >
                              {alert.severity}
                            </span>
                            <span
                              className={`neo-pill ${statusBadge(alert.status)} border-3 border-black px-3 py-1 text-xs uppercase shadow-[3px_3px_0_0_#000]`}
                            >
                              {alert.status}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="border-4 border-dashed border-black/30 p-8 text-center">
                <p className="text-sm font-bold text-black/50 uppercase tracking-wide">
                  Input an address above to initiate security scan.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SPOONOS CARD */}
        <Card className="neo-card border-black bg-black text-white">
          <CardHeader className="border-b-4 border-white/20 pb-4">
            <CardTitle className="text-lg font-black text-[#FFFF00] uppercase tracking-wider">
              {"//"} SpoonOS Agent
            </CardTitle>
            <CardDescription className="text-white/70 font-medium">
              Deep LLM-powered wallet analysis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-white pt-4">
            <p className="font-black uppercase tracking-wide text-[#00FF00]">Live API:</p>
            <pre className="border-4 border-white/30 bg-black px-4 py-3 font-mono text-xs whitespace-pre-wrap shadow-[6px_6px_0_0_#FFFF00] text-[#00FF00]">
              {`# Health Check
curl ${SPOONOS_API_URL}/health

# Analyze Wallet
curl -X POST "${SPOONOS_API_URL}/analyze?prompt=analyze%20wallet%20<addr>"

# x402 Paywalled Endpoint
curl ${SPOONOS_API_URL}/x402/requirements`}
            </pre>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge className="neo-pill bg-[#00FF00] text-black border-2 border-white/30 font-black text-xs">
                Gemini AI
              </Badge>
              <Badge className="neo-pill bg-[#FFFF00] text-black border-2 border-white/30 font-black text-xs">
                x402 Payments
              </Badge>
              <Badge className="neo-pill bg-[#00BFFF] text-black border-2 border-white/30 font-black text-xs">
                Neo N3
              </Badge>
            </div>
            <p className="text-xs text-white/60 font-medium">
              Hosted on Railway. Uses real Neo N3 blockchain data.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* COMMAND CENTER SECTION */}
      <section id="ui" className="grid gap-8 lg:grid-cols-4">
        <div className="lg:col-span-3 space-y-8">
          {/* STATS GRID - Industrial Gauges */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "TOTAL COVERAGE",
                value: formatUSD(mockSummary.totalValueUSD),
                tone: "bg-[#FFFF00]",
                icon: <ShieldCheck className="h-6 w-6" strokeWidth={3} />,
              },
              {
                label: "TX / 24H",
                value: mockSummary.dailyTx.toLocaleString(),
                tone: "bg-[#00BFFF]",
                icon: <Zap className="h-6 w-6" strokeWidth={3} />,
              },
              {
                label: "OPEN ALERTS",
                value: mockSummary.openAlerts,
                tone: "bg-[#FF0000] text-white",
                icon: <BellRing className="h-6 w-6" strokeWidth={3} />,
              },
              {
                label: "HIGH RISK",
                value: mockSummary.highRiskWallets,
                tone: "bg-[#00FF00]",
                icon: <Radar className="h-6 w-6" strokeWidth={3} />,
              },
            ].map((stat) => (
              <Card
                key={stat.label}
                className={`neo-card ${stat.tone} border-black`}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-black uppercase tracking-widest">
                    {stat.label}
                  </CardTitle>
                  {stat.icon}
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-black">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* MONITORED WALLETS TABLE */}
          <Card className="neo-card border-black bg-white">
            <CardHeader className="flex flex-row items-start justify-between gap-4 border-b-4 border-black pb-6">
              <div>
                <CardTitle className="text-2xl font-black uppercase tracking-wide">
                  Monitored Wallets
                </CardTitle>
                <CardDescription className="text-black/70 font-medium mt-1">
                  Real-time balance and risk monitoring.
                </CardDescription>
              </div>
              <Badge className="neo-pill bg-[#FF0000] text-white border-4 border-black shadow-[6px_6px_0_0_#000] font-black uppercase">
                {mockSummary.anomalies24h} Anomalies
              </Badge>
            </CardHeader>
            <CardContent className="overflow-hidden border-4 border-black bg-white mt-6">
              <Table>
                <TableHeader className="bg-black">
                  <TableRow className="border-black hover:bg-black">
                    <TableHead className="text-[#FFFF00] font-black uppercase tracking-wider text-xs">Label</TableHead>
                    <TableHead className="text-[#FFFF00] font-black uppercase tracking-wider text-xs">Address</TableHead>
                    <TableHead className="text-[#FFFF00] font-black uppercase tracking-wider text-xs">Balance</TableHead>
                    <TableHead className="text-[#FFFF00] font-black uppercase tracking-wider text-xs">Risk</TableHead>
                    <TableHead className="text-[#FFFF00] font-black uppercase tracking-wider text-xs">Chain</TableHead>
                    <TableHead className="text-[#FFFF00] font-black uppercase tracking-wider text-xs">Last Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockWallets.map((wallet, i) => (
                    <TableRow key={wallet.address} className={`border-b-2 border-black ${i % 2 === 0 ? 'bg-white' : 'bg-[#F5F5F5]'}`}>
                      <TableCell className="font-black text-black uppercase">
                        {wallet.label}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-black">
                        {wallet.address}
                      </TableCell>
                      <TableCell className="font-black text-black">
                        {formatUSD(wallet.balanceUSD)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`neo-pill ${riskTone(wallet.riskScore)} border-3 border-black px-3 py-1 text-xs font-black shadow-[3px_3px_0_0_#000]`}
                        >
                          {wallet.riskScore}/100
                        </span>
                      </TableCell>
                      <TableCell className="font-bold text-black uppercase text-xs">
                        {wallet.chains.join(", ")}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-black/70">
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

          {/* ALERTS INBOX - Industrial Warning System */}
          <Card className="neo-card border-black bg-white">
            <CardHeader className="flex flex-row items-start justify-between gap-4 border-b-4 border-black pb-6">
              <div>
                <CardTitle className="text-2xl font-black uppercase tracking-wide">
                  Threat Inbox
                </CardTitle>
                <CardDescription className="text-black/70 font-medium mt-1">
                  Active security alerts requiring attention.
                </CardDescription>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["critical", "high", "medium", "low"].map((level) => (
                    <span
                      key={level}
                      className={`neo-pill ${severityBadge(level)} border-3 border-black px-3 py-1 text-xs uppercase shadow-[4px_4px_0_0_#000]`}
                    >
                      {level}
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["open", "investigating", "closed"].map((status) => (
                    <span
                      key={status}
                      className={`neo-pill ${statusBadge(status)} border-3 border-black px-3 py-1 text-xs uppercase shadow-[4px_4px_0_0_#000]`}
                    >
                      {status}
                    </span>
                  ))}
                </div>
              </div>
              <Badge className="neo-pill bg-[#FF0000] text-white border-4 border-black shadow-[6px_6px_0_0_#000] font-black uppercase">
                {mockAlerts.length} Active
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 pt-6">
              {mockAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`neo-card ${severitySurface(alert.severity)} relative overflow-hidden border-black p-6 pt-10`}
                >
                  {/* Danger stripes for critical - handled by alert-critical class */}
                  {alert.severity === "critical" && (
                    <div className="absolute inset-x-0 top-0 h-3 danger-stripes-thin" />
                  )}
                  {alert.severity !== "critical" && (
                    <div className="absolute inset-x-0 top-0 h-2 bg-black" />
                  )}
                  
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={`neo-pill ${severityBadge(alert.severity)} border-3 border-black px-4 py-1 text-xs uppercase shadow-[4px_4px_0_0_#000] severity-stamp`}
                        >
                          {alert.severity}
                        </span>
                        <span
                          className={`neo-pill ${statusBadge(alert.status)} border-3 border-black px-4 py-1 text-xs uppercase shadow-[4px_4px_0_0_#000]`}
                        >
                          {alert.status}
                        </span>
                      </div>
                      <h3 className="flex items-center gap-3 text-xl font-black text-black uppercase tracking-wide">
                        <AlertTriangle className="h-6 w-6" strokeWidth={3} />
                        {alert.title}
                      </h3>
                      <p className="font-mono text-xs tracking-wider text-black/60 uppercase">
                        ID: {alert.id} {"//"} ADDR: {alert.walletAddress}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <span className="border-4 border-black bg-white px-3 py-2 font-mono text-xs font-black text-black shadow-[4px_4px_0_0_#000]">
                        {new Intl.DateTimeFormat("en", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(alert.createdAt))}
                      </span>
                      <Badge className="neo-pill border-4 border-black bg-[#FFFF00] text-black shadow-[4px_4px_0_0_#000] font-black uppercase animate-pulse">
                        Action Required
                      </Badge>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-black font-medium">
                    {alert.description}
                  </p>

                  <div className="mt-6 pt-4 border-t-4 border-black flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-black text-black/60 uppercase tracking-widest">
                        {"//"} Recommended Action
                      </p>
                      <p className="text-sm font-black text-black uppercase mt-1">
                        {alert.action}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="neo-button border-4 border-black bg-black text-white shadow-[6px_6px_0_0_#FFFF00] transition-none hover:translate-x-1 hover:translate-y-1 hover:shadow-[3px_3px_0_0_#FFFF00] active:translate-x-2 active:translate-y-2 active:shadow-none uppercase tracking-wider font-black px-6"
                    >
                      Investigate
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* SIDEBAR */}
        <aside className="space-y-6">
          {/* ACTIVITY FEED */}
          <Card className="neo-card border-black bg-white">
            <CardHeader className="pb-4 border-b-4 border-black">
              <CardTitle className="text-lg font-black uppercase tracking-wider">
                {"//"} Live Feed
              </CardTitle>
              <CardDescription className="text-black/60 font-medium text-xs uppercase tracking-wide">
                Real-time transaction stream
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <ScrollArea className="h-[400px] pr-2">
                <div className="space-y-4">
                  {activities.map((tx) => (
                    <div
                      key={tx.id ?? tx.hash}
                      className="neo-card border-black bg-[#F5F5F5] px-4 py-4 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-black uppercase text-xs tracking-wider">
                          {tx.type}
                        </span>
                        <span className="text-xs font-bold text-black/60 uppercase">
                          {tx.chain}
                        </span>
                      </div>
                      <p className="font-black text-black text-lg mt-1">
                        {tx.tokenSymbol} • {formatUSD(tx.amountUSD)}
                      </p>
                      {tx.riskFlag ? (
                        <p className="text-xs font-black text-[#FF0000] uppercase mt-2 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {tx.riskFlag}
                        </p>
                      ) : null}
                      <p className="text-xs font-mono text-black/50 mt-2">
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

          {/* BUILD PATH CARD */}
          <Card className="neo-card border-black bg-[#FFFF00]">
            <CardHeader className="border-b-4 border-black pb-4">
              <CardTitle className="text-lg font-black text-black uppercase tracking-wider">
                {"//"} Build Path
              </CardTitle>
              <CardDescription className="text-black/70 font-medium text-xs uppercase">
                Implementation roadmap
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-black pt-4">
              <p className="font-bold flex items-center gap-2"><span className="font-mono text-xs bg-black text-[#FFFF00] px-2 py-0.5">01</span> Scorecards from /api/summary</p>
              <p className="font-bold flex items-center gap-2"><span className="font-mono text-xs bg-black text-[#FFFF00] px-2 py-0.5">02</span> Wallet table with filters</p>
              <p className="font-bold flex items-center gap-2"><span className="font-mono text-xs bg-black text-[#FFFF00] px-2 py-0.5">03</span> Alerts inbox with severity</p>
              <p className="font-bold flex items-center gap-2"><span className="font-mono text-xs bg-black text-[#FFFF00] px-2 py-0.5">04</span> Drilldown activity timelines</p>
              <p className="font-bold flex items-center gap-2"><span className="font-mono text-xs bg-black text-[#FFFF00] px-2 py-0.5">05</span> CTA buttons per alert</p>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}
