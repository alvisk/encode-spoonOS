"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  FileText,
  GitCompare,
  Loader2,
  Plus,
  Radar,
  Shield,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

// SpoonOS API endpoint
const SPOONOS_API_URL = "https://encode-spoonos-production.up.railway.app";

// Tool response types
type ValidityScoreResult = {
  address: string;
  score: number;
  risk_level: string;
  deductions: Record<string, number>;
  metrics: {
    concentration: number;
    stablecoin_ratio: number;
    counterparty_count: number;
  };
  suspicious_patterns: string[];
  risk_flags: string[];
};

type CounterpartyRiskResult = {
  address: string;
  results: Record<
    string,
    { tags: string[]; score: number; address_type: string }
  >;
  total_counterparties: number;
  flagged_count: number;
};

type MultiWalletDiffResult = {
  addresses: string[];
  wallet_count: number;
  weighted_risk_score: number;
  risk_level: string;
  diversification_score: number;
  cross_wallet_activity: number;
  highest_risk_wallet: string;
  lowest_risk_wallet: string;
};

type ScheduleMonitorResult = {
  scheduled: boolean;
  address: string;
  interval_minutes: number;
  conditions: string[];
  monitored_wallets: string[];
};

type ApprovalScanResult = {
  approvals: Array<{ spender: string; token: string; amount: string }>;
  flags: string[];
};

type ActionDraftResult = {
  channel: string;
  message: string;
  actions: string[];
  risk_level: string;
  generated_at: string;
};

type ToolTabId =
  | "validity"
  | "counterparty"
  | "multi"
  | "monitor"
  | "approvals"
  | "report";

const TOOL_TABS = [
  {
    id: "validity" as const,
    label: "Validity Score",
    icon: <ShieldCheck className="h-4 w-4" strokeWidth={3} />,
  },
  {
    id: "counterparty" as const,
    label: "Counterparty Risk",
    icon: <Users className="h-4 w-4" strokeWidth={3} />,
  },
  {
    id: "multi" as const,
    label: "Multi-Wallet Diff",
    icon: <GitCompare className="h-4 w-4" strokeWidth={3} />,
  },
  {
    id: "monitor" as const,
    label: "Schedule Monitor",
    icon: <Clock className="h-4 w-4" strokeWidth={3} />,
  },
  {
    id: "approvals" as const,
    label: "Approval Scan",
    icon: <Shield className="h-4 w-4" strokeWidth={3} />,
  },
  {
    id: "report" as const,
    label: "Generate Report",
    icon: <FileText className="h-4 w-4" strokeWidth={3} />,
  },
];

const MONITOR_CONDITIONS = [
  "large_outflow",
  "new_token",
  "risk_score_jump",
  "suspicious_activity",
] as const;

const REPORT_CHANNELS = ["console", "dm", "email", "tweet", "alert"] as const;
type ReportChannel = (typeof REPORT_CHANNELS)[number];

export function WalletToolsDashboard() {
  // Active tool tab
  const [activeToolTab, setActiveToolTab] = useState<ToolTabId>("validity");

  // Shared address for single-wallet tools
  const [toolAddress, setToolAddress] = useState("");

  // Validity Score Tool
  const [validityLoading, setValidityLoading] = useState(false);
  const [validityResult, setValidityResult] =
    useState<ValidityScoreResult | null>(null);
  const [validityError, setValidityError] = useState<string | null>(null);

  // Counterparty Risk Tool
  const [counterpartyLoading, setCounterpartyLoading] = useState(false);
  const [counterpartyResult, setCounterpartyResult] =
    useState<CounterpartyRiskResult | null>(null);
  const [counterpartyError, setCounterpartyError] = useState<string | null>(
    null
  );

  // Multi-Wallet Diff Tool
  const [multiWalletAddresses, setMultiWalletAddresses] = useState<string[]>([
    "",
  ]);
  const [multiWalletLoading, setMultiWalletLoading] = useState(false);
  const [multiWalletResult, setMultiWalletResult] =
    useState<MultiWalletDiffResult | null>(null);
  const [multiWalletError, setMultiWalletError] = useState<string | null>(null);

  // Schedule Monitor Tool
  const [monitorInterval, setMonitorInterval] = useState(60);
  const [monitorConditions, setMonitorConditions] = useState<string[]>([
    "large_outflow",
    "risk_score_jump",
  ]);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorResult, setMonitorResult] =
    useState<ScheduleMonitorResult | null>(null);
  const [monitorError, setMonitorError] = useState<string | null>(null);

  // Approval Scan Tool
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalResult, setApprovalResult] =
    useState<ApprovalScanResult | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Action Draft Tool (Generate Report)
  const [reportChannel, setReportChannel] = useState<ReportChannel>("console");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportResult, setReportResult] = useState<ActionDraftResult | null>(
    null
  );
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportCopied, setReportCopied] = useState(false);

  // Helper to invoke SpoonOS tool
  const invokeSpoonTool = async (prompt: string): Promise<string> => {
    const res = await fetch(
      `${SPOONOS_API_URL}/analyze?prompt=${encodeURIComponent(prompt)}`,
      { method: "POST" }
    );
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { detail?: string };
      throw new Error(err.detail ?? "SpoonOS call failed");
    }
    const data = (await res.json()) as { result: string };
    return data.result;
  };

  // Helper to extract action items from report text
  const extractActions = (text: string): string[] => {
    const actions: string[] = [];
    const lines = text.split("\n");
    const bulletRegex = /^[-•*]\s+/;
    const numberedRegex = /^\d+\.\s+/;
    for (const line of lines) {
      if (bulletRegex.exec(line) ?? numberedRegex.exec(line)) {
        actions.push(line.replace(/^[-•*\d.]\s+/, "").trim());
      }
    }
    return actions.slice(0, 5);
  };

  // Validity Score Tool
  const runValidityScore = async () => {
    if (!toolAddress.trim()) return;
    setValidityLoading(true);
    setValidityError(null);
    setValidityResult(null);
    try {
      const result = await invokeSpoonTool(
        `get validity score for wallet ${toolAddress.trim()}`
      );
      const scoreMatch = /score[:\s]+(\d+)/i.exec(result);
      const riskMatch = /risk[_\s]?level[:\s]+(\w+)/i.exec(result);
      setValidityResult({
        address: toolAddress.trim(),
        score: scoreMatch?.[1] ? parseInt(scoreMatch[1]) : 50,
        risk_level: riskMatch?.[1] ?? "moderate",
        deductions: {},
        metrics: {
          concentration: 0,
          stablecoin_ratio: 0,
          counterparty_count: 0,
        },
        suspicious_patterns: [],
        risk_flags: [],
      });
    } catch (err) {
      setValidityError(
        err instanceof Error ? err.message : "Failed to get validity score"
      );
    } finally {
      setValidityLoading(false);
    }
  };

  // Counterparty Risk Tool
  const runCounterpartyRisk = async () => {
    if (!toolAddress.trim()) return;
    setCounterpartyLoading(true);
    setCounterpartyError(null);
    setCounterpartyResult(null);
    try {
      const result = await invokeSpoonTool(
        `analyze counterparty risk for wallet ${toolAddress.trim()}`
      );
      const flaggedMatch = /(\d+)\s*flagged/i.exec(result);
      setCounterpartyResult({
        address: toolAddress.trim(),
        results: {},
        total_counterparties: 0,
        flagged_count: flaggedMatch?.[1] ? parseInt(flaggedMatch[1]) : 0,
      });
    } catch (err) {
      setCounterpartyError(
        err instanceof Error
          ? err.message
          : "Failed to analyze counterparty risk"
      );
    } finally {
      setCounterpartyLoading(false);
    }
  };

  // Multi-Wallet Diff Tool
  const runMultiWalletDiff = async () => {
    const addresses = multiWalletAddresses.filter((a) => a.trim());
    if (addresses.length < 2) {
      setMultiWalletError("Please enter at least 2 wallet addresses");
      return;
    }
    setMultiWalletLoading(true);
    setMultiWalletError(null);
    setMultiWalletResult(null);
    try {
      const result = await invokeSpoonTool(
        `compare wallets ${addresses.join(" and ")}`
      );
      const riskMatch = /risk[_\s]?score[:\s]+(\d+)/i.exec(result);
      const diversMatch = /diversification[:\s]+(\d+)/i.exec(result);
      setMultiWalletResult({
        addresses,
        wallet_count: addresses.length,
        weighted_risk_score: riskMatch?.[1] ? parseInt(riskMatch[1]) : 50,
        risk_level: "moderate",
        diversification_score: diversMatch?.[1]
          ? parseInt(diversMatch[1])
          : 50,
        cross_wallet_activity: 0,
        highest_risk_wallet: addresses[0] ?? "",
        lowest_risk_wallet: addresses[addresses.length - 1] ?? "",
      });
    } catch (err) {
      setMultiWalletError(
        err instanceof Error ? err.message : "Failed to compare wallets"
      );
    } finally {
      setMultiWalletLoading(false);
    }
  };

  // Schedule Monitor Tool
  const runScheduleMonitor = async () => {
    if (!toolAddress.trim()) return;
    setMonitorLoading(true);
    setMonitorError(null);
    setMonitorResult(null);
    try {
      const result = await invokeSpoonTool(
        `schedule monitoring for wallet ${toolAddress.trim()} every ${monitorInterval} minutes with conditions ${monitorConditions.join(", ")}`
      );
      setMonitorResult({
        scheduled:
          result.toLowerCase().includes("scheduled") ||
          result.toLowerCase().includes("success"),
        address: toolAddress.trim(),
        interval_minutes: monitorInterval,
        conditions: monitorConditions,
        monitored_wallets: [toolAddress.trim()],
      });
    } catch (err) {
      setMonitorError(
        err instanceof Error ? err.message : "Failed to schedule monitor"
      );
    } finally {
      setMonitorLoading(false);
    }
  };

  // Approval Scan Tool
  const runApprovalScan = async () => {
    if (!toolAddress.trim()) return;
    setApprovalLoading(true);
    setApprovalError(null);
    setApprovalResult(null);
    try {
      const result = await invokeSpoonTool(
        `scan token approvals for wallet ${toolAddress.trim()}`
      );
      setApprovalResult({
        approvals: [],
        flags: result.toLowerCase().includes("no approvals")
          ? []
          : ["Check approval history"],
      });
    } catch (err) {
      setApprovalError(
        err instanceof Error ? err.message : "Failed to scan approvals"
      );
    } finally {
      setApprovalLoading(false);
    }
  };

  // Action Draft Tool - Generate Report
  const runGenerateReport = async () => {
    if (!toolAddress.trim() && !validityResult) {
      setReportError(
        "Please run a validity score analysis first or enter an address"
      );
      return;
    }
    setReportLoading(true);
    setReportError(null);
    setReportResult(null);
    try {
      const targetAddress = validityResult?.address ?? toolAddress.trim();
      const riskLevel = validityResult?.risk_level ?? "unknown";
      const riskFlags = validityResult?.risk_flags ?? [];

      const result = await invokeSpoonTool(
        `draft action message for wallet ${targetAddress} with risk level ${riskLevel} and flags ${riskFlags.join(", ")} for ${reportChannel} channel`
      );

      setReportResult({
        channel: reportChannel,
        message: result,
        actions: extractActions(result),
        risk_level: riskLevel,
        generated_at: new Date().toISOString(),
      });
    } catch (err) {
      setReportError(
        err instanceof Error ? err.message : "Failed to generate report"
      );
    } finally {
      setReportLoading(false);
    }
  };

  // Copy report to clipboard
  const copyReport = async () => {
    if (!reportResult) return;
    try {
      await navigator.clipboard.writeText(reportResult.message);
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 2000);
    } catch {
      // Clipboard access denied
    }
  };

  return (
    <section className="user-story-section space-y-6" data-story="business">
      {/* Section Header */}
      <div className="section-header">
        <div className="section-icon bg-[#00BFFF]">
          <Radar className="h-10 w-10 text-black" strokeWidth={2.5} />
        </div>
        <div className="section-title-group">
          <p className="section-eyebrow">User Story</p>
          <h2 className="section-title">Monitor Connected Wallets</h2>
          <p className="section-subtitle">
            dApp operators and businesses can monitor wallets connecting to
            their platform, detect risky users, and protect against fraud with
            real-time alerts.
          </p>
          <div className="section-persona">
            <span className="section-persona-tag bg-[#00BFFF]">
              dApp Developer
            </span>
            <span className="section-persona-tag bg-[#E5E5E5]">Exchange</span>
            <span className="section-persona-tag bg-[#E5E5E5]">Protocol</span>
          </div>
        </div>
        <Badge className="neo-pill border-4 border-black bg-[#00FF00] font-black uppercase text-black shadow-[4px_4px_0_0_#000]">
          {6} Tools
        </Badge>
      </div>

      {/* Shared Address Input (hidden for multi-wallet tool) */}
      {activeToolTab !== "multi" && (
        <div className="neo-card border-4 border-black bg-gray-50 p-4">
          <label className="mb-2 block text-xs font-black uppercase tracking-wider text-black/60">
            Target Wallet Address
          </label>
          <input
            value={toolAddress}
            onChange={(e) => setToolAddress(e.target.value)}
            placeholder="Enter Neo N3 address..."
            className="neo-input w-full border-4 border-black px-4 py-3 font-mono text-sm shadow-[4px_4px_0_0_#000]"
          />
        </div>
      )}

      {/* Tool Tabs */}
      <div className="flex flex-wrap gap-2">
        {TOOL_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveToolTab(tab.id)}
            className={`flex items-center gap-2 border-4 border-black px-4 py-2 text-sm font-black uppercase tracking-wide shadow-[4px_4px_0_0_#000] ${
              activeToolTab === tab.id
                ? "bg-black text-[#FFFF00]"
                : "bg-white text-black hover:bg-gray-100 active:bg-gray-200"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tool Content */}
      <Card className="neo-card border-black bg-white">
        <CardContent className="p-6">
          {/* Validity Score Tool */}
          {activeToolTab === "validity" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="border-4 border-black bg-[#00FF00] p-3">
                  <ShieldCheck
                    className="h-6 w-6 text-black"
                    strokeWidth={3}
                  />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase">
                    Wallet Validity Score
                  </h3>
                  <p className="text-sm text-black/70">
                    Compute a 0-100 risk score with detailed breakdown
                  </p>
                </div>
              </div>

              <Button
                onClick={() => void runValidityScore()}
                disabled={validityLoading || !toolAddress.trim()}
                className="neo-button border-4 border-black bg-[#00FF00] px-6 font-black uppercase text-black shadow-[4px_4px_0_0_#000]"
              >
                {validityLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Analyze"
                )}
              </Button>

              {validityError && (
                <p className="text-sm font-black uppercase text-[#FF0000]">
                  {validityError}
                </p>
              )}

              {validityResult && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="neo-card border-4 border-black bg-gradient-to-br from-white to-gray-50 p-5">
                    <p className="text-xs font-black uppercase tracking-widest text-black/60">
                      {"//"} Risk Score
                    </p>
                    <div className="mt-3 flex items-end gap-3">
                      <span
                        className={`text-5xl font-black ${validityResult.score >= 70 ? "text-[#00FF00]" : validityResult.score >= 40 ? "text-[#FFFF00]" : "text-[#FF0000]"}`}
                      >
                        {validityResult.score}
                      </span>
                      <span className="text-xl font-black text-black/40">
                        /100
                      </span>
                    </div>
                    <Badge
                      className={`neo-pill mt-3 border-3 border-black font-black uppercase ${
                        validityResult.risk_level === "clean"
                          ? "bg-[#00FF00] text-black"
                          : validityResult.risk_level === "low"
                            ? "bg-[#90EE90] text-black"
                            : validityResult.risk_level === "moderate"
                              ? "bg-[#FFFF00] text-black"
                              : "bg-[#FF0000] text-white"
                      }`}
                    >
                      {validityResult.risk_level}
                    </Badge>
                  </div>
                  <div className="neo-card border-4 border-black p-5">
                    <p className="text-xs font-black uppercase tracking-widest text-black/60">
                      {"//"} Address
                    </p>
                    <p className="mt-2 break-all font-mono text-xs">
                      {validityResult.address}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Counterparty Risk Tool */}
          {activeToolTab === "counterparty" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="border-4 border-black bg-[#FFFF00] p-3">
                  <Users className="h-6 w-6 text-black" strokeWidth={3} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase">
                    Counterparty Risk Analysis
                  </h3>
                  <p className="text-sm text-black/70">
                    Identify risky counterparties with relationship analysis
                  </p>
                </div>
              </div>

              <Button
                onClick={() => void runCounterpartyRisk()}
                disabled={counterpartyLoading || !toolAddress.trim()}
                className="neo-button border-4 border-black bg-[#FFFF00] px-6 font-black uppercase text-black shadow-[4px_4px_0_0_#000]"
              >
                {counterpartyLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Analyze"
                )}
              </Button>

              {counterpartyError && (
                <p className="text-sm font-black uppercase text-[#FF0000]">
                  {counterpartyError}
                </p>
              )}

              {counterpartyResult && (
                <div className="neo-card border-4 border-black p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-black/60">
                        {"//"} Analysis Complete
                      </p>
                      <p className="mt-2 break-all font-mono text-xs">
                        {counterpartyResult.address}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black text-[#FF0000]">
                        {counterpartyResult.flagged_count}
                      </p>
                      <p className="text-xs font-black uppercase text-black/60">
                        Flagged
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Multi-Wallet Diff Tool */}
          {activeToolTab === "multi" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="border-4 border-black bg-[#00BFFF] p-3">
                  <GitCompare
                    className="h-6 w-6 text-black"
                    strokeWidth={3}
                  />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase">
                    Multi-Wallet Comparison
                  </h3>
                  <p className="text-sm text-black/70">
                    Compare wallets for diversification and overlap analysis
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {multiWalletAddresses.map((addr, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      value={addr}
                      onChange={(e) => {
                        const newAddrs = [...multiWalletAddresses];
                        newAddrs[idx] = e.target.value;
                        setMultiWalletAddresses(newAddrs);
                      }}
                      placeholder={`Wallet ${idx + 1} address...`}
                      className="neo-input flex-1 border-4 border-black px-4 py-3 font-mono text-sm shadow-[4px_4px_0_0_#000]"
                    />
                    {multiWalletAddresses.length > 1 && (
                      <Button
                        onClick={() =>
                          setMultiWalletAddresses(
                            multiWalletAddresses.filter((_, i) => i !== idx)
                          )
                        }
                        className="neo-button border-4 border-black bg-[#FF0000] px-3 text-white shadow-[4px_4px_0_0_#000]"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <div className="flex gap-3">
                  <Button
                    onClick={() =>
                      setMultiWalletAddresses([...multiWalletAddresses, ""])
                    }
                    className="neo-button border-4 border-black bg-white px-4 font-black uppercase text-black shadow-[4px_4px_0_0_#000]"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Wallet
                  </Button>
                  <Button
                    onClick={() => void runMultiWalletDiff()}
                    disabled={
                      multiWalletLoading ||
                      multiWalletAddresses.filter((a) => a.trim()).length < 2
                    }
                    className="neo-button border-4 border-black bg-[#00BFFF] px-6 font-black uppercase text-black shadow-[4px_4px_0_0_#000]"
                  >
                    {multiWalletLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Compare"
                    )}
                  </Button>
                </div>
              </div>

              {multiWalletError && (
                <p className="text-sm font-black uppercase text-[#FF0000]">
                  {multiWalletError}
                </p>
              )}

              {multiWalletResult && (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="neo-card border-4 border-black p-5">
                    <p className="text-xs font-black uppercase tracking-widest text-black/60">
                      {"//"} Combined Risk
                    </p>
                    <p className="mt-2 text-3xl font-black">
                      {multiWalletResult.weighted_risk_score}
                    </p>
                  </div>
                  <div className="neo-card border-4 border-black p-5">
                    <p className="text-xs font-black uppercase tracking-widest text-black/60">
                      {"//"} Diversification
                    </p>
                    <p className="mt-2 text-3xl font-black">
                      {multiWalletResult.diversification_score}%
                    </p>
                  </div>
                  <div className="neo-card border-4 border-black p-5">
                    <p className="text-xs font-black uppercase tracking-widest text-black/60">
                      {"//"} Wallets
                    </p>
                    <p className="mt-2 text-3xl font-black">
                      {multiWalletResult.wallet_count}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Schedule Monitor Tool */}
          {activeToolTab === "monitor" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="border-4 border-black bg-[#FF00FF] p-3">
                  <Clock className="h-6 w-6 text-white" strokeWidth={3} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase">
                    Schedule Monitoring
                  </h3>
                  <p className="text-sm text-black/70">
                    Set up automated alerts for wallet changes
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider">
                      Interval (minutes)
                    </label>
                    <input
                      type="number"
                      value={monitorInterval}
                      onChange={(e) =>
                        setMonitorInterval(parseInt(e.target.value) || 60)
                      }
                      min={1}
                      max={1440}
                      className="neo-input mt-1 w-32 border-4 border-black px-4 py-2 font-mono text-sm shadow-[4px_4px_0_0_#000]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-black uppercase tracking-wider">
                      Alert Conditions
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {MONITOR_CONDITIONS.map((cond) => (
                        <button
                          key={cond}
                          onClick={() => {
                            if (monitorConditions.includes(cond)) {
                              setMonitorConditions(
                                monitorConditions.filter((c) => c !== cond)
                              );
                            } else {
                              setMonitorConditions([
                                ...monitorConditions,
                                cond,
                              ]);
                            }
                          }}
                          className={`neo-pill border-3 border-black px-3 py-1 text-xs font-black uppercase ${
                            monitorConditions.includes(cond)
                              ? "bg-[#00FF00] text-black shadow-[3px_3px_0_0_#000]"
                              : "bg-white text-black/50"
                          }`}
                        >
                          {cond.replace(/_/g, " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => void runScheduleMonitor()}
                  disabled={monitorLoading || !toolAddress.trim()}
                  className="neo-button border-4 border-black bg-[#FF00FF] px-6 font-black uppercase text-white shadow-[4px_4px_0_0_#000]"
                >
                  {monitorLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Schedule Monitor"
                  )}
                </Button>
              </div>

              {monitorError && (
                <p className="text-sm font-black uppercase text-[#FF0000]">
                  {monitorError}
                </p>
              )}

              {monitorResult && (
                <div className="neo-card border-4 border-black bg-[#E8F5E9] p-5">
                  <div className="flex items-center gap-3">
                    <Badge className="neo-pill border-3 border-black bg-[#00FF00] font-black uppercase text-black">
                      {monitorResult.scheduled ? "Scheduled" : "Failed"}
                    </Badge>
                    <p className="font-mono text-xs">{monitorResult.address}</p>
                  </div>
                  <p className="mt-2 text-sm font-bold">
                    Checking every {monitorResult.interval_minutes} minutes for:{" "}
                    {monitorResult.conditions.join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Approval Scan Tool */}
          {activeToolTab === "approvals" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="border-4 border-black bg-[#FF6600] p-3">
                  <Shield className="h-6 w-6 text-white" strokeWidth={3} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase">
                    Token Approval Scan
                  </h3>
                  <p className="text-sm text-black/70">
                    Scan for risky token approvals and unlimited allowances
                  </p>
                </div>
              </div>

              <Button
                onClick={() => void runApprovalScan()}
                disabled={approvalLoading || !toolAddress.trim()}
                className="neo-button border-4 border-black bg-[#FF6600] px-6 font-black uppercase text-white shadow-[4px_4px_0_0_#000]"
              >
                {approvalLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Scan"
                )}
              </Button>

              {approvalError && (
                <p className="text-sm font-black uppercase text-[#FF0000]">
                  {approvalError}
                </p>
              )}

              {approvalResult && (
                <div className="neo-card border-4 border-black p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-black/60">
                        {"//"} Scan Complete
                      </p>
                      <p className="mt-2 text-sm font-bold">
                        {approvalResult.approvals.length === 0
                          ? "No token approvals found"
                          : `${approvalResult.approvals.length} approvals found`}
                      </p>
                    </div>
                    <Badge
                      className={`neo-pill border-3 border-black font-black uppercase ${
                        approvalResult.flags.length === 0
                          ? "bg-[#00FF00] text-black"
                          : "bg-[#FF0000] text-white"
                      }`}
                    >
                      {approvalResult.flags.length === 0
                        ? "Clean"
                        : `${approvalResult.flags.length} Flags`}
                    </Badge>
                  </div>
                  {approvalResult.flags.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {approvalResult.flags.map((flag, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-sm font-bold text-[#FF0000]"
                        >
                          <AlertTriangle className="h-4 w-4" />
                          {flag}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Generate Report Tool */}
          {activeToolTab === "report" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="border-4 border-black bg-[#9C27B0] p-3">
                  <FileText className="h-6 w-6 text-white" strokeWidth={3} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase">
                    Generate Action Report
                  </h3>
                  <p className="text-sm text-black/70">
                    Create formatted security reports for different channels
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wider text-black/60">
                    Output Channel
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {REPORT_CHANNELS.map((channel) => (
                      <button
                        key={channel}
                        onClick={() => setReportChannel(channel)}
                        className={`neo-pill border-3 border-black px-4 py-2 text-sm font-black uppercase ${
                          reportChannel === channel
                            ? "bg-[#9C27B0] text-white shadow-[3px_3px_0_0_#000]"
                            : "bg-white text-black/50"
                        }`}
                      >
                        {channel}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="neo-card border-4 border-black bg-gray-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-black/60">
                    Source Data
                  </p>
                  {validityResult ? (
                    <div className="mt-2">
                      <p className="font-mono text-sm">
                        {validityResult.address}
                      </p>
                      <div className="mt-1 flex gap-2">
                        <Badge
                          className={`neo-pill border-2 border-black text-xs font-black ${
                            validityResult.risk_level === "clean" ||
                            validityResult.risk_level === "low"
                              ? "bg-[#00FF00] text-black"
                              : validityResult.risk_level === "moderate"
                                ? "bg-[#FFFF00] text-black"
                                : "bg-[#FF0000] text-white"
                          }`}
                        >
                          {validityResult.risk_level}
                        </Badge>
                        <Badge className="neo-pill border-2 border-black bg-white text-xs font-black text-black">
                          Score: {validityResult.score}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-black/50">
                      Run a Validity Score analysis first, or enter an address
                      in the shared input above
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => void runGenerateReport()}
                  disabled={
                    reportLoading || (!toolAddress.trim() && !validityResult)
                  }
                  className="neo-button border-4 border-black bg-[#9C27B0] px-6 font-black uppercase text-white shadow-[4px_4px_0_0_#000]"
                >
                  {reportLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Generate Report"
                  )}
                </Button>
              </div>

              {reportError && (
                <p className="text-sm font-black uppercase text-[#FF0000]">
                  {reportError}
                </p>
              )}

              {reportResult && (
                <div className="space-y-4">
                  {/* Report Header */}
                  <div className="neo-card border-4 border-black bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-5 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-[#9C27B0]">
                          {"//"} Generated Report
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Badge className="neo-pill border-2 border-white/30 bg-[#9C27B0] text-xs font-black uppercase text-white">
                            {reportResult.channel}
                          </Badge>
                          <Badge
                            className={`neo-pill border-2 border-white/30 text-xs font-black uppercase ${
                              reportResult.risk_level === "clean" ||
                              reportResult.risk_level === "low"
                                ? "bg-[#00FF00] text-black"
                                : reportResult.risk_level === "moderate"
                                  ? "bg-[#FFFF00] text-black"
                                  : "bg-[#FF0000] text-white"
                            }`}
                          >
                            {reportResult.risk_level}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        onClick={() => void copyReport()}
                        className="neo-button border-2 border-white/30 bg-white/10 px-3 py-2 text-white hover:bg-white/20"
                      >
                        {reportCopied ? (
                          <Check className="h-4 w-4 text-[#00FF00]" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Report Content */}
                  <div className="neo-card border-4 border-black bg-white p-5">
                    <p className="text-xs font-black uppercase tracking-widest text-black/60">
                      {"//"} Message Content
                    </p>
                    <div className="mt-3 whitespace-pre-wrap rounded border-2 border-black/20 bg-gray-50 p-4 font-mono text-sm">
                      {reportResult.message}
                    </div>
                  </div>

                  {/* Recommended Actions */}
                  {reportResult.actions.length > 0 && (
                    <div className="neo-card border-4 border-black bg-[#E3F2FD] p-5">
                      <p className="text-xs font-black uppercase tracking-widest text-black/60">
                        {"//"} Recommended Actions
                      </p>
                      <ul className="mt-3 space-y-2">
                        {reportResult.actions.map((action, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm font-medium"
                          >
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center bg-black text-xs font-black text-white">
                              {idx + 1}
                            </span>
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-xs text-black/50">
                    Generated at{" "}
                    {new Date(reportResult.generated_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
