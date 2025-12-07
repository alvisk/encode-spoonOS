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
  Shield,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

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

const TOOL_TABS: Array<{
  id: ToolTabId;
  label: string;
  shortLabel: string;
  color: string;
}> = [
  { id: "validity", label: "Validity Score", shortLabel: "Validity", color: "#00FF00" },
  { id: "counterparty", label: "Counterparty Risk", shortLabel: "Counterparty", color: "#FFFF00" },
  { id: "multi", label: "Multi-Wallet Diff", shortLabel: "Multi-Wallet", color: "#00BFFF" },
  { id: "monitor", label: "Schedule Monitor", shortLabel: "Monitor", color: "#FF00FF" },
  { id: "approvals", label: "Approval Scan", shortLabel: "Approvals", color: "#FF6600" },
  { id: "report", label: "Generate Report", shortLabel: "Report", color: "#9C27B0" },
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
  const [activeToolTab, setActiveToolTab] = useState<ToolTabId>("validity");
  const [toolAddress, setToolAddress] = useState("");

  // Validity Score
  const [validityLoading, setValidityLoading] = useState(false);
  const [validityResult, setValidityResult] = useState<ValidityScoreResult | null>(null);
  const [validityError, setValidityError] = useState<string | null>(null);

  // Counterparty Risk
  const [counterpartyLoading, setCounterpartyLoading] = useState(false);
  const [counterpartyResult, setCounterpartyResult] = useState<CounterpartyRiskResult | null>(null);
  const [counterpartyError, setCounterpartyError] = useState<string | null>(null);

  // Multi-Wallet Diff
  const [multiWalletAddresses, setMultiWalletAddresses] = useState<string[]>([""]);
  const [multiWalletLoading, setMultiWalletLoading] = useState(false);
  const [multiWalletResult, setMultiWalletResult] = useState<MultiWalletDiffResult | null>(null);
  const [multiWalletError, setMultiWalletError] = useState<string | null>(null);

  // Schedule Monitor
  const [monitorInterval, setMonitorInterval] = useState(60);
  const [monitorConditions, setMonitorConditions] = useState<string[]>(["large_outflow", "risk_score_jump"]);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorResult, setMonitorResult] = useState<ScheduleMonitorResult | null>(null);
  const [monitorError, setMonitorError] = useState<string | null>(null);

  // Approval Scan
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalResult, setApprovalResult] = useState<ApprovalScanResult | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Generate Report
  const [reportChannel, setReportChannel] = useState<ReportChannel>("console");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportResult, setReportResult] = useState<ActionDraftResult | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportCopied, setReportCopied] = useState(false);

  const activeTab = TOOL_TABS.find((t) => t.id === activeToolTab)!;

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

  const extractActions = (text: string): string[] => {
    const actions: string[] = [];
    const lines = text.split("\n");
    for (const line of lines) {
      if (/^[-•*]\s+/.exec(line) ?? /^\d+\.\s+/.exec(line)) {
        actions.push(line.replace(/^[-•*\d.]\s+/, "").trim());
      }
    }
    return actions.slice(0, 5);
  };

  const runValidityScore = async () => {
    if (!toolAddress.trim()) return;
    setValidityLoading(true);
    setValidityError(null);
    setValidityResult(null);
    try {
      const result = await invokeSpoonTool(`get validity score for wallet ${toolAddress.trim()}`);
      const scoreMatch = /score[:\s]+(\d+)/i.exec(result);
      const riskMatch = /risk[_\s]?level[:\s]+(\w+)/i.exec(result);
      setValidityResult({
        address: toolAddress.trim(),
        score: scoreMatch?.[1] ? parseInt(scoreMatch[1]) : 50,
        risk_level: riskMatch?.[1] ?? "moderate",
        deductions: {},
        metrics: { concentration: 0, stablecoin_ratio: 0, counterparty_count: 0 },
        suspicious_patterns: [],
        risk_flags: [],
      });
    } catch (err) {
      setValidityError(err instanceof Error ? err.message : "Failed to get validity score");
    } finally {
      setValidityLoading(false);
    }
  };

  const runCounterpartyRisk = async () => {
    if (!toolAddress.trim()) return;
    setCounterpartyLoading(true);
    setCounterpartyError(null);
    setCounterpartyResult(null);
    try {
      const result = await invokeSpoonTool(`analyze counterparty risk for wallet ${toolAddress.trim()}`);
      const flaggedMatch = /(\d+)\s*flagged/i.exec(result);
      setCounterpartyResult({
        address: toolAddress.trim(),
        results: {},
        total_counterparties: 0,
        flagged_count: flaggedMatch?.[1] ? parseInt(flaggedMatch[1]) : 0,
      });
    } catch (err) {
      setCounterpartyError(err instanceof Error ? err.message : "Failed to analyze counterparty risk");
    } finally {
      setCounterpartyLoading(false);
    }
  };

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
      const result = await invokeSpoonTool(`compare wallets ${addresses.join(" and ")}`);
      const riskMatch = /risk[_\s]?score[:\s]+(\d+)/i.exec(result);
      const diversMatch = /diversification[:\s]+(\d+)/i.exec(result);
      setMultiWalletResult({
        addresses,
        wallet_count: addresses.length,
        weighted_risk_score: riskMatch?.[1] ? parseInt(riskMatch[1]) : 50,
        risk_level: "moderate",
        diversification_score: diversMatch?.[1] ? parseInt(diversMatch[1]) : 50,
        cross_wallet_activity: 0,
        highest_risk_wallet: addresses[0] ?? "",
        lowest_risk_wallet: addresses[addresses.length - 1] ?? "",
      });
    } catch (err) {
      setMultiWalletError(err instanceof Error ? err.message : "Failed to compare wallets");
    } finally {
      setMultiWalletLoading(false);
    }
  };

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
        scheduled: result.toLowerCase().includes("scheduled") || result.toLowerCase().includes("success"),
        address: toolAddress.trim(),
        interval_minutes: monitorInterval,
        conditions: monitorConditions,
        monitored_wallets: [toolAddress.trim()],
      });
    } catch (err) {
      setMonitorError(err instanceof Error ? err.message : "Failed to schedule monitor");
    } finally {
      setMonitorLoading(false);
    }
  };

  const runApprovalScan = async () => {
    if (!toolAddress.trim()) return;
    setApprovalLoading(true);
    setApprovalError(null);
    setApprovalResult(null);
    try {
      const result = await invokeSpoonTool(`scan token approvals for wallet ${toolAddress.trim()}`);
      setApprovalResult({
        approvals: [],
        flags: result.toLowerCase().includes("no approvals") ? [] : ["Check approval history"],
      });
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "Failed to scan approvals");
    } finally {
      setApprovalLoading(false);
    }
  };

  const runGenerateReport = async () => {
    if (!toolAddress.trim() && !validityResult) {
      setReportError("Please run a validity score analysis first or enter an address");
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
      setReportError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setReportLoading(false);
    }
  };

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

  const getRiskColor = (level: string) => {
    if (level === "clean" || level === "low") return "bg-[#00FF00] text-black";
    if (level === "moderate") return "bg-[#FFFF00] text-black";
    return "bg-[#FF0000] text-white";
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-[#00FF00]";
    if (score >= 40) return "text-[#FFFF00]";
    return "text-[#FF0000]";
  };

  return (
    <div className="neo-card overflow-hidden border-4 border-black bg-white shadow-[8px_8px_0_0_#000]">
      {/* Header */}
      <div
        className="border-b-4 border-black px-6 py-4"
        style={{ backgroundColor: activeTab.color }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black uppercase tracking-tight text-black">
            Wallet Analysis Tools
          </h2>
          <Badge className="border-2 border-black bg-black px-3 py-1 font-mono text-xs font-bold text-white">
            {TOOL_TABS.length} TOOLS
          </Badge>
        </div>
      </div>

      {/* Tool Tabs */}
      <div className="flex overflow-x-auto border-b-4 border-black bg-gray-100">
        {TOOL_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveToolTab(tab.id)}
            className={`flex-shrink-0 border-r-2 border-black px-4 py-3 text-xs font-black uppercase tracking-wide transition-colors ${
              activeToolTab === tab.id
                ? "bg-black text-white"
                : "bg-transparent text-black/70 hover:bg-black/10"
            }`}
          >
            {tab.shortLabel}
          </button>
        ))}
      </div>

      {/* Address Input */}
      {activeToolTab !== "multi" && (
        <div className="border-b-4 border-black bg-gray-50 px-6 py-4">
          <label className="mb-2 block text-xs font-black uppercase tracking-wider text-black/50">
            Target Wallet Address
          </label>
          <input
            value={toolAddress}
            onChange={(e) => setToolAddress(e.target.value)}
            placeholder="Enter Neo N3 address..."
            className="w-full border-3 border-black bg-white px-4 py-3 font-mono text-sm shadow-[3px_3px_0_0_#000] outline-none focus:shadow-[4px_4px_0_0_#000]"
          />
        </div>
      )}

      {/* Tool Content */}
      <div className="p-6">
        {/* Validity Score */}
        {activeToolTab === "validity" && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="border-3 border-black bg-[#00FF00] p-2.5">
                <ShieldCheck className="h-5 w-5 text-black" strokeWidth={3} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black uppercase">Wallet Validity Score</h3>
                <p className="text-sm text-black/60">Compute a 0-100 risk score with detailed breakdown</p>
              </div>
              <Button
                onClick={() => void runValidityScore()}
                disabled={validityLoading || !toolAddress.trim()}
                className="border-3 border-black bg-[#00FF00] px-5 py-2 font-black uppercase text-black shadow-[3px_3px_0_0_#000] hover:shadow-[4px_4px_0_0_#000] disabled:opacity-50"
              >
                {validityLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analyze"}
              </Button>
            </div>

            {validityError && (
              <p className="text-sm font-bold text-[#FF0000]">{validityError}</p>
            )}

            {validityResult && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="border-3 border-black bg-gradient-to-br from-white to-gray-50 p-4">
                  <p className="text-xs font-bold uppercase text-black/50">Risk Score</p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className={`text-4xl font-black ${getScoreColor(validityResult.score)}`}>
                      {validityResult.score}
                    </span>
                    <span className="pb-1 text-lg font-bold text-black/30">/100</span>
                  </div>
                  <Badge className={`mt-2 border-2 border-black text-xs font-black uppercase ${getRiskColor(validityResult.risk_level)}`}>
                    {validityResult.risk_level}
                  </Badge>
                </div>
                <div className="border-3 border-black p-4">
                  <p className="text-xs font-bold uppercase text-black/50">Address</p>
                  <p className="mt-2 break-all font-mono text-xs">{validityResult.address}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Counterparty Risk */}
        {activeToolTab === "counterparty" && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="border-3 border-black bg-[#FFFF00] p-2.5">
                <Users className="h-5 w-5 text-black" strokeWidth={3} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black uppercase">Counterparty Risk Analysis</h3>
                <p className="text-sm text-black/60">Identify risky counterparties with relationship analysis</p>
              </div>
              <Button
                onClick={() => void runCounterpartyRisk()}
                disabled={counterpartyLoading || !toolAddress.trim()}
                className="border-3 border-black bg-[#FFFF00] px-5 py-2 font-black uppercase text-black shadow-[3px_3px_0_0_#000] hover:shadow-[4px_4px_0_0_#000] disabled:opacity-50"
              >
                {counterpartyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analyze"}
              </Button>
            </div>

            {counterpartyError && (
              <p className="text-sm font-bold text-[#FF0000]">{counterpartyError}</p>
            )}

            {counterpartyResult && (
              <div className="flex items-center justify-between border-3 border-black p-4">
                <div>
                  <p className="text-xs font-bold uppercase text-black/50">Analysis Complete</p>
                  <p className="mt-1 break-all font-mono text-xs">{counterpartyResult.address}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-[#FF0000]">{counterpartyResult.flagged_count}</p>
                  <p className="text-xs font-bold uppercase text-black/50">Flagged</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Multi-Wallet Diff */}
        {activeToolTab === "multi" && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="border-3 border-black bg-[#00BFFF] p-2.5">
                <GitCompare className="h-5 w-5 text-black" strokeWidth={3} />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase">Multi-Wallet Comparison</h3>
                <p className="text-sm text-black/60">Compare wallets for diversification and overlap analysis</p>
              </div>
            </div>

            <div className="space-y-2">
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
                    className="flex-1 border-3 border-black bg-white px-4 py-2.5 font-mono text-sm shadow-[3px_3px_0_0_#000] outline-none"
                  />
                  {multiWalletAddresses.length > 1 && (
                    <Button
                      onClick={() => setMultiWalletAddresses(multiWalletAddresses.filter((_, i) => i !== idx))}
                      className="border-3 border-black bg-[#FF0000] px-3 text-white shadow-[3px_3px_0_0_#000]"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setMultiWalletAddresses([...multiWalletAddresses, ""])}
                className="border-3 border-black bg-white px-4 py-2 font-black uppercase text-black shadow-[3px_3px_0_0_#000]"
              >
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
              <Button
                onClick={() => void runMultiWalletDiff()}
                disabled={multiWalletLoading || multiWalletAddresses.filter((a) => a.trim()).length < 2}
                className="border-3 border-black bg-[#00BFFF] px-5 py-2 font-black uppercase text-black shadow-[3px_3px_0_0_#000] disabled:opacity-50"
              >
                {multiWalletLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Compare"}
              </Button>
            </div>

            {multiWalletError && (
              <p className="text-sm font-bold text-[#FF0000]">{multiWalletError}</p>
            )}

            {multiWalletResult && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="border-3 border-black p-4 text-center">
                  <p className="text-xs font-bold uppercase text-black/50">Combined Risk</p>
                  <p className="mt-1 text-2xl font-black">{multiWalletResult.weighted_risk_score}</p>
                </div>
                <div className="border-3 border-black p-4 text-center">
                  <p className="text-xs font-bold uppercase text-black/50">Diversification</p>
                  <p className="mt-1 text-2xl font-black">{multiWalletResult.diversification_score}%</p>
                </div>
                <div className="border-3 border-black p-4 text-center">
                  <p className="text-xs font-bold uppercase text-black/50">Wallets</p>
                  <p className="mt-1 text-2xl font-black">{multiWalletResult.wallet_count}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Schedule Monitor */}
        {activeToolTab === "monitor" && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="border-3 border-black bg-[#FF00FF] p-2.5">
                <Clock className="h-5 w-5 text-white" strokeWidth={3} />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase">Schedule Monitoring</h3>
                <p className="text-sm text-black/60">Set up automated alerts for wallet changes</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-black/50">Interval (min)</label>
                <input
                  type="number"
                  value={monitorInterval}
                  onChange={(e) => setMonitorInterval(parseInt(e.target.value) || 60)}
                  min={1}
                  max={1440}
                  className="mt-1 block w-24 border-3 border-black px-3 py-2 font-mono text-sm shadow-[3px_3px_0_0_#000] outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold uppercase text-black/50">Conditions</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {MONITOR_CONDITIONS.map((cond) => (
                    <button
                      key={cond}
                      onClick={() => {
                        setMonitorConditions(
                          monitorConditions.includes(cond)
                            ? monitorConditions.filter((c) => c !== cond)
                            : [...monitorConditions, cond]
                        );
                      }}
                      className={`border-2 border-black px-3 py-1 text-xs font-bold uppercase ${
                        monitorConditions.includes(cond)
                          ? "bg-[#00FF00] text-black shadow-[2px_2px_0_0_#000]"
                          : "bg-white text-black/40"
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
              className="border-3 border-black bg-[#FF00FF] px-5 py-2 font-black uppercase text-white shadow-[3px_3px_0_0_#000] disabled:opacity-50"
            >
              {monitorLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Schedule"}
            </Button>

            {monitorError && (
              <p className="text-sm font-bold text-[#FF0000]">{monitorError}</p>
            )}

            {monitorResult && (
              <div className="border-3 border-black bg-[#E8F5E9] p-4">
                <div className="flex items-center gap-2">
                  <Badge className="border-2 border-black bg-[#00FF00] font-bold uppercase text-black">
                    {monitorResult.scheduled ? "Scheduled" : "Failed"}
                  </Badge>
                  <span className="font-mono text-xs">{monitorResult.address}</span>
                </div>
                <p className="mt-2 text-sm">
                  Checking every <strong>{monitorResult.interval_minutes}</strong> minutes for:{" "}
                  <strong>{monitorResult.conditions.join(", ")}</strong>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Approval Scan */}
        {activeToolTab === "approvals" && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="border-3 border-black bg-[#FF6600] p-2.5">
                <Shield className="h-5 w-5 text-white" strokeWidth={3} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black uppercase">Token Approval Scan</h3>
                <p className="text-sm text-black/60">Scan for risky token approvals and unlimited allowances</p>
              </div>
              <Button
                onClick={() => void runApprovalScan()}
                disabled={approvalLoading || !toolAddress.trim()}
                className="border-3 border-black bg-[#FF6600] px-5 py-2 font-black uppercase text-white shadow-[3px_3px_0_0_#000] disabled:opacity-50"
              >
                {approvalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scan"}
              </Button>
            </div>

            {approvalError && (
              <p className="text-sm font-bold text-[#FF0000]">{approvalError}</p>
            )}

            {approvalResult && (
              <div className="border-3 border-black p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase text-black/50">Scan Complete</p>
                    <p className="mt-1 text-sm">
                      {approvalResult.approvals.length === 0
                        ? "No token approvals found"
                        : `${approvalResult.approvals.length} approvals found`}
                    </p>
                  </div>
                  <Badge
                    className={`border-2 border-black font-bold uppercase ${
                      approvalResult.flags.length === 0 ? "bg-[#00FF00] text-black" : "bg-[#FF0000] text-white"
                    }`}
                  >
                    {approvalResult.flags.length === 0 ? "Clean" : `${approvalResult.flags.length} Flags`}
                  </Badge>
                </div>
                {approvalResult.flags.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {approvalResult.flags.map((flag, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm font-bold text-[#FF0000]">
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

        {/* Generate Report */}
        {activeToolTab === "report" && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="border-3 border-black bg-[#9C27B0] p-2.5">
                <FileText className="h-5 w-5 text-white" strokeWidth={3} />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase">Generate Action Report</h3>
                <p className="text-sm text-black/60">Create formatted security reports for different channels</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-black/50">Output Channel</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {REPORT_CHANNELS.map((channel) => (
                  <button
                    key={channel}
                    onClick={() => setReportChannel(channel)}
                    className={`border-2 border-black px-4 py-1.5 text-xs font-bold uppercase ${
                      reportChannel === channel
                        ? "bg-[#9C27B0] text-white shadow-[2px_2px_0_0_#000]"
                        : "bg-white text-black/40"
                    }`}
                  >
                    {channel}
                  </button>
                ))}
              </div>
            </div>

            {validityResult && (
              <div className="border-3 border-black bg-gray-50 p-4">
                <p className="text-xs font-bold uppercase text-black/50">Source Data</p>
                <p className="mt-1 font-mono text-sm">{validityResult.address}</p>
                <div className="mt-2 flex gap-2">
                  <Badge className={`border-2 border-black text-xs font-bold ${getRiskColor(validityResult.risk_level)}`}>
                    {validityResult.risk_level}
                  </Badge>
                  <Badge className="border-2 border-black bg-white text-xs font-bold text-black">
                    Score: {validityResult.score}
                  </Badge>
                </div>
              </div>
            )}

            <Button
              onClick={() => void runGenerateReport()}
              disabled={reportLoading || (!toolAddress.trim() && !validityResult)}
              className="border-3 border-black bg-[#9C27B0] px-5 py-2 font-black uppercase text-white shadow-[3px_3px_0_0_#000] disabled:opacity-50"
            >
              {reportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
            </Button>

            {reportError && (
              <p className="text-sm font-bold text-[#FF0000]">{reportError}</p>
            )}

            {reportResult && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-3 border-black bg-[#1a1a2e] p-4 text-white">
                  <div>
                    <p className="text-xs font-bold uppercase text-[#9C27B0]">Generated Report</p>
                    <div className="mt-2 flex gap-2">
                      <Badge className="border border-white/30 bg-[#9C27B0] text-xs font-bold uppercase text-white">
                        {reportResult.channel}
                      </Badge>
                      <Badge className={`border border-white/30 text-xs font-bold uppercase ${getRiskColor(reportResult.risk_level)}`}>
                        {reportResult.risk_level}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    onClick={() => void copyReport()}
                    className="border border-white/30 bg-white/10 p-2 text-white hover:bg-white/20"
                  >
                    {reportCopied ? <Check className="h-4 w-4 text-[#00FF00]" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="border-3 border-black p-4">
                  <p className="text-xs font-bold uppercase text-black/50">Message</p>
                  <div className="mt-2 whitespace-pre-wrap rounded border border-black/20 bg-gray-50 p-3 font-mono text-sm">
                    {reportResult.message}
                  </div>
                </div>

                {reportResult.actions.length > 0 && (
                  <div className="border-3 border-black bg-[#E3F2FD] p-4">
                    <p className="text-xs font-bold uppercase text-black/50">Recommended Actions</p>
                    <ul className="mt-2 space-y-1.5">
                      {reportResult.actions.map((action, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center bg-black text-xs font-bold text-white">
                            {idx + 1}
                          </span>
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-xs text-black/40">
                  Generated at {new Date(reportResult.generated_at).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
