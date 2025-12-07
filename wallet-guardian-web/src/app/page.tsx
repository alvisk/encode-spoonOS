"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  Radar,
  ShieldCheck,
  Zap,
  Bot,
  CreditCard,
  Users,
  GitCompare,
  Clock,
  Shield,
  Plus,
  X,
  Loader2,
  Bug,
  FileText,
  Copy,
  Check,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useVoiceAnnouncements } from "~/hooks/useVoiceAnnouncements";
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

// Malicious Contract Detector Tool Response
type MaliciousContractResult = {
  contract_address: string;
  chain: string;
  is_malicious: boolean;
  risk_score: number;
  risk_level: string;
  detected_issues: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
  summary: string;
  verified: boolean;
  contract_name?: string;
};

// Action Draft Tool Response
type ActionDraftResult = {
  channel: string;
  message: string;
  actions: string[];
  risk_level: string;
  generated_at: string;
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
  
  // Voice announcements hook
  const voice = useVoiceAnnouncements();
  
  // Aggregate activities from all wallets and sort by timestamp
  const allActivities = Object.values(mockActivityByAddress)
    .flat()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const activities = allActivities;

  // Scanner mode toggle
  const [scannerMode, setScannerMode] = useState<"wallet" | "contract">("wallet");
  
  const [scanAddress, setScanAddress] = useState("");
  const [scanStatus, setScanStatus] = useState<
    "idle" | "loading" | "error" | "done" | "payment_required"
  >("idle");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanWallet, setScanWallet] = useState<Wallet | null>(null);
  const [scanActivity, setScanActivity] = useState<Activity[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<SpoonOSAnalysis | null>(null);
  const [streamedText, setStreamedText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingRef = useRef<boolean>(false);
  const [usePaywalled, setUsePaywalled] = useState(true); // Default to x402 paywalled endpoint
  const [x402Requirements, setX402Requirements] =
    useState<X402Requirements | null>(null);
  const [paymentHeader, setPaymentHeader] = useState("");

  // Tool-specific state
  const [activeToolTab, setActiveToolTab] = useState<
    "validity" | "counterparty" | "multi" | "monitor" | "approvals" | "report"
  >("validity");

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
    null,
  );

  // Multi-Wallet Diff Tool (uses its own addresses array)
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

  // Malicious Contract Detector Tool
  const [contractAddress, setContractAddress] = useState("");
  const [contractChain, setContractChain] = useState<"ethereum" | "sepolia">("ethereum");
  const [contractLoading, setContractLoading] = useState(false);
  const [contractResult, setContractResult] = useState<MaliciousContractResult | null>(null);
  const [contractError, setContractError] = useState<string | null>(null);

  // Action Draft Tool
  const [reportChannel, setReportChannel] = useState<"console" | "dm" | "email" | "tweet" | "alert">("console");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportResult, setReportResult] = useState<ActionDraftResult | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportCopied, setReportCopied] = useState(false);

  const scanAlerts = useMemo(
    () =>
      scanWallet
        ? mockAlerts.filter((a) => a.walletAddress === scanWallet.address)
        : [],
    [scanWallet],
  );

  // Abort controller for cancelling streaming requests
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Track previous values for voice announcements
  const prevAiAnalysisRef = useRef<SpoonOSAnalysis | null>(null);
  const prevContractResultRef = useRef<MaliciousContractResult | null>(null);

  // Stop streaming when component unmounts or new scan starts
  useEffect(() => {
    return () => {
      streamingRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Voice announcement when AI analysis completes
  useEffect(() => {
    if (
      aiAnalysis && 
      aiAnalysis !== prevAiAnalysisRef.current && 
      scanWallet?.address &&
      !isStreaming
    ) {
      // Extract risk level from the analysis text
      const riskMatch = /risk[:\s]*level[:\s]*(\w+)/i.exec(aiAnalysis.result);
      const riskLevel = riskMatch?.[1] ?? "unknown";
      
      // Extract a brief summary (first sentence or key finding)
      const firstSentence = aiAnalysis.result.split(/[.!?]/)[0];
      const keyFinding = firstSentence && firstSentence.length < 150 
        ? firstSentence.trim() 
        : undefined;
      
      voice.speakAIAnalysis(scanWallet.address, riskLevel, keyFinding);
      prevAiAnalysisRef.current = aiAnalysis;
    }
  }, [aiAnalysis, scanWallet?.address, isStreaming, voice]);

  // Voice announcement when contract scan completes
  useEffect(() => {
    if (
      contractResult && 
      contractResult !== prevContractResultRef.current
    ) {
      voice.speakContractVerdict(
        contractResult.is_malicious,
        contractResult.contract_address,
        contractResult.risk_score
      );
      prevContractResultRef.current = contractResult;
    }
  }, [contractResult, voice]);

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
    setStreamedText("");
    streamingRef.current = false; // Stop any existing streaming

    // Use override payment header if provided, otherwise use state
    const effectivePaymentHeader: string =
      typeof overridePaymentHeader === "string"
        ? overridePaymentHeader
        : typeof paymentHeader === "string"
          ? paymentHeader
          : "";

    // Don't reset x402Requirements if we have a payment header (retry scenario)
    if (!effectivePaymentHeader || effectivePaymentHeader.length === 0) {
      setX402Requirements(null);
    }

    const encoded = encodeURIComponent(scanAddress.trim());

    // Fetch wallet data and activity immediately (non-AI dependent)
    const fetchWalletData = async () => {
      try {
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
          const addr = scanAddress.trim();
          const detectedChain = addr.startsWith("0x") ? "Ethereum" : "Neo N3";
          setScanWallet({
            address: addr,
            label: "Scanned Wallet",
            balanceUSD: 0,
            riskScore: 50,
            chains: [detectedChain],
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
      } catch (err) {
        console.error("Failed to fetch wallet data:", err);
        // Still show minimal wallet info on error
        const addr = scanAddress.trim();
        const detectedChain = addr.startsWith("0x") ? "Ethereum" : "Neo N3";
        setScanWallet({
          address: addr,
          label: "Scanned Wallet",
          balanceUSD: 0,
          riskScore: 50,
          chains: [detectedChain],
          lastActive: new Date().toISOString(),
          tags: [],
        });
        setScanActivity([]);
      }
    };

    // Fetch AI analysis with real streaming
    const fetchAiAnalysis = async () => {
      // Cancel any existing streaming request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      try {
        if (usePaywalled) {
          // Use the x402 paywalled endpoint (non-streaming for now)
          const headers: HeadersInit = {
            "Content-Type": "application/json",
          };

          // Add payment header if provided
          if (effectivePaymentHeader && effectivePaymentHeader.length > 0) {
            headers["X-PAYMENT"] = effectivePaymentHeader;
            console.log(
              "[x402] Sending payment header:",
              effectivePaymentHeader.substring(0, 50) + "...",
            );
          } else {
            console.log("[x402] No payment header, initial request");
          }

          console.log(
            "[x402] Making request to:",
            `${SPOONOS_API_URL}/x402/invoke/wallet-guardian`,
          );

          const spoonRes = await fetch(
            `${SPOONOS_API_URL}/x402/invoke/wallet-guardian`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                prompt: `analyze wallet ${scanAddress.trim()}`,
              }),
              signal: abortControllerRef.current.signal,
            },
          );

          console.log("[x402] Response status:", spoonRes.status);

          // Handle 402 Payment Required
          if (spoonRes.status === 402) {
            // If we already sent a payment header and still got 402, the payment was rejected
            if (effectivePaymentHeader && effectivePaymentHeader.length > 0) {
              const errorData = (await spoonRes.json()) as {
                error?: string;
                payer?: string;
              };
              console.error("[x402] Payment rejected:", errorData);
              setScanError(
                `Payment rejected: ${errorData.error ?? "Unknown error"}`,
              );
              setPaymentHeader(""); // Clear the invalid payment header
              setScanStatus("error");
              return;
            }

            const paymentData = (await spoonRes.json()) as {
              accepts?: X402Requirements[];
            };
            if (paymentData.accepts && paymentData.accepts.length > 0) {
              setX402Requirements(paymentData.accepts[0] ?? null);
            }
            setScanStatus("payment_required");
            return;
          }

          if (!spoonRes.ok) {
            const err = (await spoonRes.json().catch(() => ({}))) as {
              detail?: string;
            };
            throw new Error(err.detail ?? "SpoonOS API error");
          }

          const spoonData = (await spoonRes.json()) as SpoonOSAnalysis;
          setAiAnalysis(spoonData);
          setStreamedText(spoonData.result ?? "");
        } else {
          // Use the free streaming endpoint
          const prompt = encodeURIComponent(
            `analyze wallet ${scanAddress.trim()}`,
          );
          
          setIsStreaming(true);
          streamingRef.current = true;
          setStreamedText("");

          const response = await fetch(
            `${SPOONOS_API_URL}/analyze/stream?prompt=${prompt}`,
            {
              method: "POST",
              signal: abortControllerRef.current.signal,
            },
          );

          if (!response.ok) {
            const err = (await response.json().catch(() => ({}))) as {
              detail?: string;
            };
            throw new Error(err.detail ?? "SpoonOS API error");
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error("No response body");
          }

          const decoder = new TextDecoder();
          let fullText = "";

          try {
            while (streamingRef.current) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              // Parse SSE format: data: <content>\n\n
              const lines = chunk.split("\n");
              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const data = line.slice(6); // Remove "data: " prefix
                  if (data === "[DONE]") {
                    streamingRef.current = false;
                    setIsStreaming(false);
                    break;
                  } else if (data === "[CLEAR]") {
                    // Clear previous text (used when switching from status to actual response)
                    fullText = "";
                    setStreamedText(fullText);
                  } else if (data.startsWith("[ERROR]")) {
                    throw new Error(data.slice(8));
                  } else {
                    fullText += data;
                    setStreamedText(fullText);
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }

          // Set final AI analysis
          setAiAnalysis({ result: fullText });
          setIsStreaming(false);
          streamingRef.current = false;
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          console.log("AI analysis request aborted");
          return;
        }
        console.error("AI analysis failed:", err);
        setIsStreaming(false);
        streamingRef.current = false;
        // Don't set error status - wallet data is still valid
        // Just leave AI analysis as null
      }
    };

    try {
      // Start both fetches in parallel - wallet data will display immediately
      // while AI analysis loads in the background
      await Promise.all([
        fetchWalletData(),
        fetchAiAnalysis(),
      ]);

      // Only set done if we haven't already set payment_required or error
      setScanStatus((current) => 
        current === "loading" ? "done" : current
      );
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Unexpected error");
      setScanStatus("error");
    }
  };

  // Helper to invoke SpoonOS tools
  const invokeSpoonTool = async (prompt: string): Promise<string> => {
    const res = await fetch(
      `${SPOONOS_API_URL}/analyze?prompt=${encodeURIComponent(prompt)}`,
      {
        method: "POST",
      },
    );
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { detail?: string };
      throw new Error(err.detail ?? "SpoonOS API error");
    }
    const data = (await res.json()) as SpoonOSAnalysis;
    return data.result;
  };

  // Validity Score Tool
  const runValidityScore = async () => {
    if (!toolAddress.trim()) return;
    setValidityLoading(true);
    setValidityError(null);
    setValidityResult(null);
    try {
      const result = await invokeSpoonTool(
        `get validity score for wallet ${toolAddress.trim()}`,
      );
      // Parse the result - SpoonOS returns text, we'll extract key info
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
        err instanceof Error ? err.message : "Failed to get validity score",
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
        `analyze counterparty risk for wallet ${toolAddress.trim()}`,
      );
      // Parse counterparty info from result
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
          : "Failed to analyze counterparty risk",
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
        `compare wallets ${addresses.join(" and ")}`,
      );
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
      setMultiWalletError(
        err instanceof Error ? err.message : "Failed to compare wallets",
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
        `schedule monitoring for wallet ${toolAddress.trim()} every ${monitorInterval} minutes with conditions ${monitorConditions.join(", ")}`,
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
        err instanceof Error ? err.message : "Failed to schedule monitor",
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
        `scan token approvals for wallet ${toolAddress.trim()}`,
      );
      setApprovalResult({
        approvals: [],
        flags: result.toLowerCase().includes("no approvals")
          ? []
          : ["Check approval history"],
      });
    } catch (err) {
      setApprovalError(
        err instanceof Error ? err.message : "Failed to scan approvals",
      );
    } finally {
      setApprovalLoading(false);
    }
  };

  // Malicious Contract Detector Tool
  const runContractScan = async () => {
    if (!contractAddress.trim()) return;
    setContractLoading(true);
    setContractError(null);
    setContractResult(null);
    try {
      // Call the backend v2 endpoint directly for structured data
      const res = await fetch(
        `${SPOONOS_API_URL}/api/v2/contract-scan/${encodeURIComponent(contractAddress.trim())}?chain=${contractChain}`,
      );
      
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(err.detail ?? "Contract scan failed");
      }
      
      const data = (await res.json()) as MaliciousContractResult;
      setContractResult(data);
    } catch (err) {
      // Fallback to SpoonOS natural language if direct endpoint fails
      try {
        const result = await invokeSpoonTool(
          `scan contract ${contractAddress.trim()} on ${contractChain} for malicious patterns`,
        );
        // Parse the result
        const isMalicious = result.toLowerCase().includes("malicious") || 
                           result.toLowerCase().includes("suspicious") ||
                           result.toLowerCase().includes("high risk");
        const riskMatch = /risk[_\s]?score[:\s]+(\d+)/i.exec(result);
        const riskLevelMatch = /risk[_\s]?level[:\s]+(\w+)/i.exec(result);
        
        setContractResult({
          contract_address: contractAddress.trim(),
          chain: contractChain,
          is_malicious: isMalicious,
          risk_score: riskMatch?.[1] ? parseInt(riskMatch[1]) : (isMalicious ? 75 : 25),
          risk_level: riskLevelMatch?.[1] ?? (isMalicious ? "high" : "low"),
          detected_issues: isMalicious ? [{ type: "suspicious_pattern", severity: "high", description: "AI detected potential malicious patterns" }] : [],
          summary: result,
          verified: false,
        });
      } catch {
        setContractError(
          err instanceof Error ? err.message : "Failed to scan contract",
        );
      }
    } finally {
      setContractLoading(false);
    }
  };

  // Action Draft Tool - Generate Report
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
        `draft action message for wallet ${targetAddress} with risk level ${riskLevel} and flags ${riskFlags.join(", ")} for ${reportChannel} channel`,
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
        err instanceof Error ? err.message : "Failed to generate report",
      );
    } finally {
      setReportLoading(false);
    }
  };

  // Helper to extract action items from report text
  const extractActions = (text: string): string[] => {
    const actions: string[] = [];
    const lines = text.split('\n');
    const bulletRegex = /^[-•*]\s+/;
    const numberedRegex = /^\d+\.\s+/;
    for (const line of lines) {
      if (bulletRegex.exec(line) ?? numberedRegex.exec(line)) {
        actions.push(line.replace(/^[-•*\d.]\s+/, '').trim());
      }
    }
    return actions.length > 0 ? actions : ["Review wallet activity", "Monitor for changes"];
  };

  // Copy report to clipboard
  const copyReport = async () => {
    if (!reportResult) return;
    try {
      await navigator.clipboard.writeText(reportResult.message);
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-10 px-6 pt-12 pb-20">
      {/* HERO SECTION - Industrial Command Center */}
      <section className="neo-hero neo-card relative z-10 border-black px-10 py-14">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-5xl font-black tracking-[0.2em] text-black uppercase sm:text-7xl lg:text-8xl xl:text-9xl">
                ASSERTION OS
              </h1>
              <div className="mt-4 h-2 w-32 bg-black" />
              <p className="mt-6 max-w-2xl text-lg font-bold tracking-wide text-black uppercase">
                Industrial-grade multi-chain wallet security. Monitor. Detect.
                Assert.
              </p>
              <p className="mt-2 max-w-2xl text-sm font-medium text-black/70">
                A SpoonOS agent that analyzes wallets, surfaces risks, and
                generates actionable alerts.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Button
                asChild
                className="neo-button border-4 border-black bg-white font-bold tracking-wider text-black uppercase shadow-[8px_8px_0_0_#000] transition-none hover:translate-x-1 hover:translate-y-1 hover:shadow-[4px_4px_0_0_#000] active:translate-x-2 active:translate-y-2 active:shadow-none"
              >
                <a href="/api/summary" target="_blank" rel="noreferrer">
                  View API
                </a>
              </Button>
              <Button
                variant="secondary"
                asChild
                className="neo-button border-4 border-black bg-[#FFFF00] font-bold tracking-wider text-black uppercase shadow-[8px_8px_0_0_#000] transition-none hover:translate-x-1 hover:translate-y-1 hover:shadow-[4px_4px_0_0_#000] active:translate-x-2 active:translate-y-2 active:shadow-none"
              >
                <a href="#ui">Command Center</a>
              </Button>
              
              {/* Voice Toggle Button */}
              <Button
                onClick={voice.toggleEnabled}
                className={`neo-button border-4 border-black px-4 font-bold tracking-wider uppercase shadow-[8px_8px_0_0_#000] transition-none hover:translate-x-1 hover:translate-y-1 hover:shadow-[4px_4px_0_0_#000] active:translate-x-2 active:translate-y-2 active:shadow-none ${
                  voice.config.enabled 
                    ? "bg-[#00FF00] text-black" 
                    : "bg-gray-300 text-black/50"
                }`}
                title={voice.config.enabled ? "Voice alerts enabled" : "Voice alerts disabled"}
              >
                {voice.config.enabled ? (
                  <Volume2 className="h-5 w-5" strokeWidth={3} />
                ) : (
                  <VolumeX className="h-5 w-5" strokeWidth={3} />
                )}
                <span className="ml-2 hidden sm:inline">
                  {voice.config.enabled ? "Voice On" : "Voice Off"}
                </span>
              </Button>
              {voice.isSpeaking && (
                <span className="animate-pulse text-xs font-black text-[#00FF00] uppercase">
                  Speaking...
                </span>
              )}
            </div>
          </div>
          <div className="neo-card flex flex-col gap-3 border-4 border-black bg-black px-6 py-5 text-sm text-white shadow-[8px_8px_0_0_#FFFF00]">
            <p className="font-black tracking-widest text-[#FFFF00] uppercase">
              {"//"} API ENDPOINTS
            </p>
            <Separator className="bg-white/30" />
            <ul className="space-y-2 font-mono text-xs text-white/90">
              <li className="flex items-center gap-2">
                <span className="text-[#00FF00]">GET</span> /api/summary
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#00FF00]">GET</span> /api/wallets
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#00FF00]">GET</span>{" "}
                /api/wallets/[address]
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#00FF00]">GET</span>{" "}
                /api/wallets/[address]/activity
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#00FF00]">GET</span> /api/alerts
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* SECTION DIVIDER - INDIVIDUAL USER */}
      <div className="section-divider">
        <span className="section-divider-label bg-[#00FF00]">
          Individual User
        </span>
      </div>

      {/* INDIVIDUAL USER SECTION */}
      <section className="user-story-section" data-story="individual">
        <div className="section-header">
          <div className="section-icon">
            <ShieldCheck className="h-10 w-10 text-black" strokeWidth={2.5} />
          </div>
          <div className="section-title-group">
            <p className="section-eyebrow">User Story</p>
            <h2 className="section-title">Protect Your Wallet</h2>
            <p className="section-subtitle">
              Scan your own wallet for security risks, check for malicious
              contract approvals, and verify counterparties before transacting.
            </p>
            <div className="section-persona">
              <span className="section-persona-tag bg-[#00FF00]">
                Crypto Holder
              </span>
              <span className="section-persona-tag bg-[#E5E5E5]">
                DeFi User
              </span>
              <span className="section-persona-tag bg-[#E5E5E5]">
                NFT Collector
              </span>
            </div>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="neo-card border-black bg-white lg:col-span-2">
            <CardHeader className="flex flex-col gap-4 border-b-4 border-black pb-6">
              {/* Scanner Mode Tabs */}
              <div className="flex">
                <button
                  onClick={() => setScannerMode("wallet")}
                  className={`flex items-center justify-center gap-2 border-4 border-black px-6 py-3 text-sm font-black tracking-wide uppercase transition-colors min-w-[200px] ${
                    scannerMode === "wallet"
                      ? "bg-[#00FF00] text-black border-r-0"
                      : "bg-white text-black/50 hover:bg-gray-100 border-r-0"
                  }`}
                >
                  <ShieldCheck className="h-5 w-5 shrink-0" strokeWidth={3} />
                  <span>Wallet Scanner</span>
                </button>
                <button
                  onClick={() => setScannerMode("contract")}
                  className={`flex items-center justify-center gap-2 border-4 border-black px-6 py-3 text-sm font-black tracking-wide uppercase transition-colors min-w-[200px] ${
                    scannerMode === "contract"
                      ? "bg-[#FF0000] text-white"
                      : "bg-white text-black/50 hover:bg-gray-100"
                  }`}
                >
                  <Bug className="h-5 w-5 shrink-0" strokeWidth={3} />
                  <span>Contract Scanner</span>
                </button>
              </div>
              
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl font-black tracking-wide uppercase">
                    {scannerMode === "wallet" ? "Wallet Scanner" : "Contract Scanner"}
                  </CardTitle>
                  <CardDescription className="mt-1 font-medium text-black/70">
                    {scannerMode === "wallet" 
                      ? "Input a Neo N3 or Ethereum address for instant security analysis."
                      : "Scan Ethereum smart contracts for malicious patterns using AI."}
                  </CardDescription>
                </div>
                <Badge className={`neo-pill border-4 border-black font-black text-black uppercase shadow-[6px_6px_0_0_#000] ${
                  scannerMode === "wallet" ? "bg-[#FFFF00]" : "bg-[#FF6600] text-white"
                }`}>
                  {scannerMode === "wallet" ? "Beta" : "AI Powered"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* WALLET SCANNER CONTENT */}
              {scannerMode === "wallet" && (
                <>
              <div className="flex flex-col gap-3">
                <label
                  className="text-sm font-black tracking-wider text-black uppercase"
                  htmlFor="scan"
                >
                  Target Address
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    id="scan"
                    value={scanAddress}
                    onChange={(e) => setScanAddress(e.target.value)}
                    placeholder="Enter Neo N3 (N...) or Ethereum (0x...) address..."
                    className="neo-input w-full border-4 border-black px-4 py-3 font-mono text-sm shadow-[6px_6px_0_0_#000] transition-none focus:translate-x-0.5 focus:translate-y-0.5 focus:shadow-[4px_4px_0_0_#000] focus:outline-none"
                  />
                  <Button
                    onClick={() => void runSelfScan()}
                    disabled={scanStatus === "loading" || !scanAddress.trim()}
                    className="neo-button border-4 border-black bg-[#00FF00] px-8 font-black tracking-wider text-black uppercase shadow-[6px_6px_0_0_#000] transition-none hover:translate-x-1 hover:translate-y-1 hover:shadow-[3px_3px_0_0_#000] active:translate-x-2 active:translate-y-2 active:shadow-none disabled:opacity-50"
                  >
                    {scanStatus === "loading" ? "SCANNING..." : "SCAN"}
                  </Button>
                </div>
                {scanError ? (
                  <p className="text-sm font-black tracking-wide text-[#FF0000] uppercase">
                    ERROR: {scanError}
                  </p>
                ) : null}
                
                {/* Quick Examples */}
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-bold text-black/60">Examples:</span>
                  <button
                    onClick={() => setScanAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")}
                    className="font-mono text-[#0066CC] hover:underline hover:text-[#0044AA] transition-colors"
                  >
                    vitalik.eth
                  </button>
                  <span className="text-black/30">|</span>
                  <button
                    onClick={() => setScanAddress("NTTGFxiBtGX28xMTTFyjZhG3n6s5p9kvcd")}
                    className="font-mono text-[#00AA66] hover:underline hover:text-[#008855] transition-colors"
                  >
                    Neo N3 Wallet
                  </button>
                  <span className="text-black/30">|</span>
                  <button
                    onClick={() => setScanAddress("0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B")}
                    className="font-mono text-[#9933FF] hover:underline hover:text-[#7722DD] transition-colors"
                  >
                    Early ETH Whale
                  </button>
                </div>
              </div>

              {/* PAYWALLED ENDPOINT TOGGLE */}
              <div className="flex flex-col gap-4 border-4 border-black bg-[#1a1a2e] p-5 shadow-[6px_6px_0_0_#FFFF00]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded border-2 border-black bg-[#FFFF00] p-2">
                      <CreditCard
                        className="h-5 w-5 text-black"
                        strokeWidth={3}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-black tracking-wider text-[#FFFF00] uppercase">
                        x402 Paywalled Mode
                      </p>
                      <p className="text-xs text-white/60">
                        Use the monetized endpoint (0.01 USDC/call on Base
                        Sepolia)
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setUsePaywalled(!usePaywalled)}
                    className={`relative h-8 w-14 rounded-none border-4 border-black transition-colors ${
                      usePaywalled ? "bg-[#00FF00]" : "bg-white/20"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 bg-black transition-transform ${
                        usePaywalled ? "left-7" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>

                {usePaywalled && scanStatus !== "payment_required" && (
                  <div className="border-t border-white/20 pt-3">
                    <p className="text-xs text-white/50">
                      When you scan a wallet, you&apos;ll be prompted to pay
                      with your connected wallet.
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
                    console.log(
                      "[x402] Payment complete, retrying with header length:",
                      signedPaymentHeader.length,
                    );
                    // Voice announcement for payment completion
                    voice.speakAlert(
                      "Payment authorized successfully. Starting wallet analysis.",
                      "info"
                    );
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
                      <div className="mb-4 flex items-center gap-3">
                        <div className="rounded border-2 border-black bg-[#FFFF00] p-2">
                          <Bot className="h-6 w-6 text-black" strokeWidth={3} />
                        </div>
                        <div>
                          <p className="text-xs font-black tracking-widest text-[#FFFF00] uppercase">
                            {"//"} SPOONOS AI ANALYSIS
                          </p>
                          <p className="font-mono text-xs text-white/60">
                            Agent: wallet-guardian
                          </p>
                        </div>
                        <Badge className={`neo-pill ml-auto border-2 border-black text-xs font-black uppercase shadow-[3px_3px_0_0_#FFFF00] ${isStreaming ? "bg-[#FFFF00] text-black animate-pulse" : "bg-[#00FF00] text-black"}`}>
                          {isStreaming ? "Streaming..." : "Complete"}
                        </Badge>
                      </div>
                      <div className="prose prose-invert prose-sm max-w-none">
                        <div className="text-sm leading-relaxed font-medium whitespace-pre-wrap text-white/90">
                          {streamedText || aiAnalysis.result}
                          {isStreaming && (
                            <span className="inline-block w-2 h-4 ml-0.5 bg-[#00FF00] animate-pulse" />
                          )}
                        </div>
                      </div>
                      <div className="mt-4 border-t border-white/20 pt-4">
                        <p className="font-mono text-xs text-white/50">
                          Powered by SpoonOS x402 Gateway • Neo N3 Blockchain
                          {aiAnalysis.payer && (
                            <span className="mt-1 block">
                              Paid by: {aiAnalysis.payer.slice(0, 6)}...
                              {aiAnalysis.payer.slice(-4)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* AI Loading State - Show while AI analysis is loading */
                    <div className="neo-card border-4 border-black bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-6 text-white">
                      <div className="flex items-center gap-3">
                        <div className="rounded border-2 border-black bg-[#FFFF00] p-2">
                          <Loader2 className="h-6 w-6 text-black animate-spin" strokeWidth={3} />
                        </div>
                        <div>
                          <p className="text-xs font-black tracking-widest text-[#FFFF00] uppercase">
                            {"//"} ANALYZING WALLET
                          </p>
                          <p className="font-mono text-xs text-white/60">
                            SpoonOS Agent Processing...
                          </p>
                        </div>
                        <Badge className="neo-pill ml-auto border-2 border-black bg-[#FFFF00] text-xs font-black text-black uppercase shadow-[3px_3px_0_0_#00FF00] animate-pulse">
                          Analyzing
                        </Badge>
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="h-3 bg-white/10 rounded animate-pulse" />
                        <div className="h-3 bg-white/10 rounded animate-pulse w-4/5" />
                        <div className="h-3 bg-white/10 rounded animate-pulse w-3/5" />
                      </div>
                    </div>
                  )}

                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* WALLET INFO CARD */}
                    <div className="neo-card border-4 border-black bg-white p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <p className="text-xs font-black tracking-widest text-black uppercase">
                            {"//"} ADDRESS
                          </p>
                          <p className="font-mono text-sm break-all text-black">
                            {scanWallet.address}
                          </p>
                        </div>
                        <Badge
                          className={`neo-pill ${riskTone(scanWallet.riskScore)} border-4 border-black font-black shadow-[4px_4px_0_0_#000]`}
                        >
                          {scanWallet.riskScore}/100
                        </Badge>
                      </div>
                      <div className="mt-4 border-t-2 border-black pt-4">
                        <p className="text-sm font-bold text-black">
                          {scanWallet.label ?? "UNKNOWN WALLET"}
                        </p>
                        <p className="text-xs tracking-wide text-black/70 uppercase">
                          Chains: {scanWallet.chains?.join(", ") || "Neo N3"}
                        </p>
                        <p className="mt-2 text-2xl font-black text-black">
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
                      <p className="text-xs font-black tracking-widest text-black uppercase">
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
                                <p className="max-w-[150px] truncate font-mono text-xs text-black/60">
                                  {tx.hash}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-bold text-black uppercase">
                                  {tx.chain}
                                </p>
                                <p className="text-sm font-black text-black">
                                  {formatUSD(tx.amountUSD)}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ALERTS CARD */}
                  <div
                    className={`neo-card border-4 border-black p-5 ${scanAlerts.some((a) => a.severity === "critical") ? "alert-critical bg-[#FFE5E5]" : "bg-[#FFF8E1]"}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black tracking-widest text-black uppercase">
                        {"//"} THREAT ANALYSIS
                      </p>
                      <Badge
                        className={`neo-pill ${scanAlerts.length > 0 ? "bg-[#FF0000] text-white" : "bg-[#00FF00] text-black"} border-4 border-black font-black uppercase shadow-[4px_4px_0_0_#000]`}
                      >
                        {scanAlerts.length}{" "}
                        {scanAlerts.length === 1 ? "Alert" : "Alerts"}
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
                            <p className="mt-1 text-xs text-black/70">
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
                  <p className="text-sm font-bold tracking-wide text-black/50 uppercase">
                    Input an address above to initiate security scan.
                  </p>
                </div>
              )}
                </>
              )}

              {/* CONTRACT SCANNER CONTENT */}
              {scannerMode === "contract" && (
                <>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3">
                      <label className="text-sm font-black tracking-wider text-black uppercase">
                        Contract Address
                      </label>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                          value={contractAddress}
                          onChange={(e) => setContractAddress(e.target.value)}
                          placeholder="Enter Ethereum contract address (0x...)"
                          className="neo-input w-full border-4 border-black px-4 py-3 font-mono text-sm shadow-[6px_6px_0_0_#000] transition-none focus:translate-x-0.5 focus:translate-y-0.5 focus:shadow-[4px_4px_0_0_#000] focus:outline-none"
                        />
                        <Button
                          onClick={() => void runContractScan()}
                          disabled={contractLoading || !contractAddress.trim()}
                          className="neo-button border-4 border-black bg-[#FF0000] px-8 font-black tracking-wider text-white uppercase shadow-[6px_6px_0_0_#000] transition-none hover:translate-x-1 hover:translate-y-1 hover:shadow-[3px_3px_0_0_#000] active:translate-x-2 active:translate-y-2 active:shadow-none disabled:opacity-50"
                        >
                          {contractLoading ? "SCANNING..." : "SCAN"}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-xs font-black tracking-wider text-black/60 uppercase">
                        Network:
                      </span>
                      <div className="flex gap-2">
                        {(["ethereum", "sepolia"] as const).map((chain) => (
                          <button
                            key={chain}
                            onClick={() => setContractChain(chain)}
                            className={`neo-pill border-3 border-black px-4 py-2 text-xs font-black uppercase ${
                              contractChain === chain
                                ? "bg-[#00BFFF] text-black shadow-[3px_3px_0_0_#000]"
                                : "bg-white text-black/50 hover:bg-gray-100"
                            }`}
                          >
                            {chain === "ethereum" ? "Mainnet" : "Sepolia"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quick Examples */}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-bold text-black/60">Examples:</span>
                      <button
                        onClick={() => {
                          setContractAddress("0xbb9bc244d798123fde783fcc1c72d3bb8c189413");
                          setContractChain("ethereum");
                        }}
                        className="font-mono text-[#FF0000] hover:underline hover:text-[#CC0000] transition-colors"
                      >
                        The DAO (Hacked)
                      </button>
                      <span className="text-black/30">|</span>
                      <button
                        onClick={() => {
                          setContractAddress("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
                          setContractChain("ethereum");
                        }}
                        className="font-mono text-[#00AA66] hover:underline hover:text-[#008855] transition-colors"
                      >
                        USDC (Safe)
                      </button>
                      <span className="text-black/30">|</span>
                      <button
                        onClick={() => {
                          setContractAddress("0xdAC17F958D2ee523a2206206994597C13D831ec7");
                          setContractChain("ethereum");
                        }}
                        className="font-mono text-[#0066CC] hover:underline hover:text-[#0044AA] transition-colors"
                      >
                        USDT (Tether)
                      </button>
                    </div>

                    {contractError && (
                      <p className="text-sm font-black tracking-wide text-[#FF0000] uppercase">
                        ERROR: {contractError}
                      </p>
                    )}
                  </div>

                  {contractResult ? (
                    <div className="space-y-6">
                      {/* Main Verdict Card */}
                      <div className={`neo-card border-4 border-black p-6 ${
                        contractResult.is_malicious 
                          ? "bg-gradient-to-br from-[#FFE5E5] to-[#FFCCCC]" 
                          : "bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9]"
                      }`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              {contractResult.is_malicious ? (
                                <div className="border-4 border-black bg-[#FF0000] p-2">
                                  <AlertTriangle className="h-6 w-6 text-white" strokeWidth={3} />
                                </div>
                              ) : (
                                <div className="border-4 border-black bg-[#00FF00] p-2">
                                  <ShieldCheck className="h-6 w-6 text-black" strokeWidth={3} />
                                </div>
                              )}
                              <div>
                                <p className="text-3xl font-black uppercase">
                                  {contractResult.is_malicious ? "MALICIOUS" : "SAFE"}
                                </p>
                                <p className="text-sm font-bold text-black/70">
                                  Contract Analysis Complete
                                </p>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-black tracking-widest text-black/60 uppercase">
                                Contract Address
                              </p>
                              <p className="mt-1 font-mono text-sm break-all">
                                {contractResult.contract_address}
                              </p>
                              {contractResult.contract_name && (
                                <p className="mt-1 text-sm font-bold">
                                  {contractResult.contract_name}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right space-y-2">
                            <div className={`neo-pill border-4 border-black px-4 py-2 font-black ${
                              contractResult.risk_score >= 70
                                ? "bg-[#FF0000] text-white"
                                : contractResult.risk_score >= 40
                                  ? "bg-[#FFFF00] text-black"
                                  : "bg-[#00FF00] text-black"
                            }`}>
                              <p className="text-2xl">{contractResult.risk_score}</p>
                              <p className="text-xs uppercase">/100 Risk</p>
                            </div>
                            <Badge className="neo-pill border-2 border-black bg-[#00BFFF] text-xs font-black text-black uppercase">
                              {contractResult.chain}
                            </Badge>
                            {contractResult.verified && (
                              <Badge className="neo-pill border-2 border-black bg-white text-xs font-black text-black">
                                Verified
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Detected Issues */}
                      {contractResult.detected_issues.length > 0 && (
                        <div className="neo-card border-4 border-black bg-[#FFF8E1] p-5">
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-xs font-black tracking-widest text-black uppercase">
                              {"//"} Detected Issues
                            </p>
                            <Badge className="neo-pill border-3 border-black bg-[#FF0000] text-xs font-black text-white uppercase">
                              {contractResult.detected_issues.length} Found
                            </Badge>
                          </div>
                          <div className="space-y-3">
                            {contractResult.detected_issues.map((issue, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-3 border-4 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]"
                              >
                                <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${
                                  issue.severity === "critical" || issue.severity === "high"
                                    ? "text-[#FF0000]"
                                    : issue.severity === "medium"
                                      ? "text-[#FFAA00]"
                                      : "text-[#00BFFF]"
                                }`} strokeWidth={3} />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-black uppercase">
                                      {issue.type?.replace(/_/g, " ") ?? "Unknown Issue"}
                                    </p>
                                    <Badge className={`neo-pill border-2 border-black text-xs font-black uppercase ${
                                      issue.severity === "critical" ? "bg-[#FF0000] text-white" :
                                      issue.severity === "high" ? "bg-[#FFAA00] text-black" :
                                      issue.severity === "medium" ? "bg-[#FFFF00] text-black" :
                                      "bg-[#00BFFF] text-black"
                                    }`}>
                                      {issue.severity ?? "unknown"}
                                    </Badge>
                                  </div>
                                  <p className="mt-1 text-sm text-black/70">
                                    {issue.description ?? "No description available"}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI Summary */}
                      {contractResult.summary && (
                        <div className="neo-card border-4 border-black bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-6 text-white">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="rounded border-2 border-black bg-[#FF0000] p-2">
                              <Bot className="h-5 w-5 text-white" strokeWidth={3} />
                            </div>
                            <div>
                              <p className="text-xs font-black tracking-widest text-[#FF6600] uppercase">
                                {"//"} AI Analysis
                              </p>
                              <p className="font-mono text-xs text-white/60">
                                Malicious Pattern Detection
                              </p>
                            </div>
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap text-white/90">
                            {contractResult.summary}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="border-4 border-dashed border-black/30 p-8 text-center">
                      <Bug className="mx-auto h-12 w-12 text-black/30 mb-3" strokeWidth={2} />
                      <p className="text-sm font-bold tracking-wide text-black/50 uppercase">
                        Enter a contract address to scan for malicious patterns.
                      </p>
                      <p className="mt-2 text-xs text-black/40">
                        Supports Ethereum Mainnet and Sepolia testnet
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* SPOONOS CARD */}
          <Card className="neo-card border-black bg-black text-white">
            <CardHeader className="border-b-4 border-white/20 pb-4">
              <CardTitle className="text-lg font-black tracking-wider text-[#FFFF00] uppercase">
                {"//"} SpoonOS Agent
              </CardTitle>
              <CardDescription className="font-medium text-white/70">
                Deep LLM-powered wallet analysis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-sm text-white">
              <p className="font-black tracking-wide text-[#00FF00] uppercase">
                Live API:
              </p>
              <pre className="border-4 border-white/30 bg-black px-4 py-3 font-mono text-xs whitespace-pre-wrap text-[#00FF00] shadow-[6px_6px_0_0_#FFFF00]">
                {`# Health Check
curl ${SPOONOS_API_URL}/health

# Analyze Wallet
curl -X POST "${SPOONOS_API_URL}/analyze?prompt=analyze%20wallet%20<addr>"

# x402 Paywalled Endpoint
curl ${SPOONOS_API_URL}/x402/requirements`}
              </pre>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className="neo-pill border-2 border-white/30 bg-[#00FF00] text-xs font-black text-black">
                  Gemini AI
                </Badge>
                <Badge className="neo-pill border-2 border-white/30 bg-[#FFFF00] text-xs font-black text-black">
                  x402 Payments
                </Badge>
                <Badge className="neo-pill border-2 border-white/30 bg-[#00BFFF] text-xs font-black text-black">
                  Neo N3
                </Badge>
              </div>
              <p className="text-xs font-medium text-white/60">
                Hosted on Railway. Uses real Neo N3 blockchain data.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* SECTION DIVIDER - BUSINESS */}
      <div className="section-divider">
        <span className="section-divider-label bg-[#00BFFF]">
          Business / dApp
        </span>
      </div>

      {/* BUSINESS DASHBOARD SECTION */}
      <section className="user-story-section space-y-6" data-story="business">
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
          <Badge className="neo-pill border-4 border-black bg-[#00FF00] font-black text-black uppercase shadow-[4px_4px_0_0_#000]">
            {6} Tools
          </Badge>
        </div>

        {/* Shared Address Input */}
        {activeToolTab !== "multi" && (
          <div className="neo-card border-4 border-black bg-gray-50 p-4">
            <label className="mb-2 block text-xs font-black tracking-wider text-black/60 uppercase">
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
          {[
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
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveToolTab(tab.id)}
              className={`flex items-center gap-2 border-4 border-black px-4 py-2 text-sm font-black tracking-wide uppercase shadow-[4px_4px_0_0_#000] ${
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
                  className="neo-button border-4 border-black bg-[#00FF00] px-6 font-black text-black uppercase shadow-[4px_4px_0_0_#000]"
                >
                  {validityLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Analyze"
                  )}
                </Button>

                {validityError && (
                  <p className="text-sm font-black text-[#FF0000] uppercase">
                    {validityError}
                  </p>
                )}

                {validityResult && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="neo-card border-4 border-black bg-gradient-to-br from-white to-gray-50 p-5">
                      <p className="text-xs font-black tracking-widest text-black/60 uppercase">
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
                      <p className="text-xs font-black tracking-widest text-black/60 uppercase">
                        {"//"} Address
                      </p>
                      <p className="mt-2 font-mono text-xs break-all">
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
                  className="neo-button border-4 border-black bg-[#FFFF00] px-6 font-black text-black uppercase shadow-[4px_4px_0_0_#000]"
                >
                  {counterpartyLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Analyze"
                  )}
                </Button>

                {counterpartyError && (
                  <p className="text-sm font-black text-[#FF0000] uppercase">
                    {counterpartyError}
                  </p>
                )}

                {counterpartyResult && (
                  <div className="neo-card border-4 border-black p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black tracking-widest text-black/60 uppercase">
                          {"//"} Analysis Complete
                        </p>
                        <p className="mt-2 font-mono text-xs break-all">
                          {counterpartyResult.address}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black text-[#FF0000]">
                          {counterpartyResult.flagged_count}
                        </p>
                        <p className="text-xs font-black text-black/60 uppercase">
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
                              multiWalletAddresses.filter((_, i) => i !== idx),
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
                      className="neo-button border-4 border-black bg-white px-4 font-black text-black uppercase shadow-[4px_4px_0_0_#000]"
                    >
                      <Plus className="mr-2 h-4 w-4" /> Add Wallet
                    </Button>
                    <Button
                      onClick={() => void runMultiWalletDiff()}
                      disabled={
                        multiWalletLoading ||
                        multiWalletAddresses.filter((a) => a.trim()).length < 2
                      }
                      className="neo-button border-4 border-black bg-[#00BFFF] px-6 font-black text-black uppercase shadow-[4px_4px_0_0_#000]"
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
                  <p className="text-sm font-black text-[#FF0000] uppercase">
                    {multiWalletError}
                  </p>
                )}

                {multiWalletResult && (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="neo-card border-4 border-black p-5">
                      <p className="text-xs font-black tracking-widest text-black/60 uppercase">
                        {"//"} Combined Risk
                      </p>
                      <p className="mt-2 text-3xl font-black">
                        {multiWalletResult.weighted_risk_score}
                      </p>
                    </div>
                    <div className="neo-card border-4 border-black p-5">
                      <p className="text-xs font-black tracking-widest text-black/60 uppercase">
                        {"//"} Diversification
                      </p>
                      <p className="mt-2 text-3xl font-black">
                        {multiWalletResult.diversification_score}%
                      </p>
                    </div>
                    <div className="neo-card border-4 border-black p-5">
                      <p className="text-xs font-black tracking-widest text-black/60 uppercase">
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
                      <label className="text-xs font-black tracking-wider uppercase">
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
                      <label className="text-xs font-black tracking-wider uppercase">
                        Alert Conditions
                      </label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[
                          "large_outflow",
                          "new_token",
                          "risk_score_jump",
                          "suspicious_activity",
                        ].map((cond) => (
                          <button
                            key={cond}
                            onClick={() => {
                              if (monitorConditions.includes(cond)) {
                                setMonitorConditions(
                                  monitorConditions.filter((c) => c !== cond),
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
                    className="neo-button border-4 border-black bg-[#FF00FF] px-6 font-black text-white uppercase shadow-[4px_4px_0_0_#000]"
                  >
                    {monitorLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Schedule Monitor"
                    )}
                  </Button>
                </div>

                {monitorError && (
                  <p className="text-sm font-black text-[#FF0000] uppercase">
                    {monitorError}
                  </p>
                )}

                {monitorResult && (
                  <div className="neo-card border-4 border-black bg-[#E8F5E9] p-5">
                    <div className="flex items-center gap-3">
                      <Badge className="neo-pill border-3 border-black bg-[#00FF00] font-black text-black uppercase">
                        {monitorResult.scheduled ? "Scheduled" : "Failed"}
                      </Badge>
                      <p className="font-mono text-xs">
                        {monitorResult.address}
                      </p>
                    </div>
                    <p className="mt-2 text-sm font-bold">
                      Checking every {monitorResult.interval_minutes} minutes
                      for: {monitorResult.conditions.join(", ")}
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
                  className="neo-button border-4 border-black bg-[#FF6600] px-6 font-black text-white uppercase shadow-[4px_4px_0_0_#000]"
                >
                  {approvalLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Scan"
                  )}
                </Button>

                {approvalError && (
                  <p className="text-sm font-black text-[#FF0000] uppercase">
                    {approvalError}
                  </p>
                )}

                {approvalResult && (
                  <div className="neo-card border-4 border-black p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black tracking-widest text-black/60 uppercase">
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
                    <label className="mb-2 block text-xs font-black tracking-wider text-black/60 uppercase">
                      Output Channel
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(["console", "dm", "email", "tweet", "alert"] as const).map((channel) => (
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
                    <p className="text-xs font-black tracking-wider text-black/60 uppercase">
                      Source Data
                    </p>
                    {validityResult ? (
                      <div className="mt-2">
                        <p className="font-mono text-sm">{validityResult.address}</p>
                        <div className="mt-1 flex gap-2">
                          <Badge className={`neo-pill border-2 border-black text-xs font-black ${
                            validityResult.risk_level === "clean" || validityResult.risk_level === "low"
                              ? "bg-[#00FF00] text-black"
                              : validityResult.risk_level === "moderate"
                                ? "bg-[#FFFF00] text-black"
                                : "bg-[#FF0000] text-white"
                          }`}>
                            {validityResult.risk_level}
                          </Badge>
                          <Badge className="neo-pill border-2 border-black bg-white text-xs font-black text-black">
                            Score: {validityResult.score}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-black/50">
                        Run a Validity Score analysis first, or enter an address in the shared input above
                      </p>
                    )}
                  </div>

                  <Button
                    onClick={() => void runGenerateReport()}
                    disabled={reportLoading || (!toolAddress.trim() && !validityResult)}
                    className="neo-button border-4 border-black bg-[#9C27B0] px-6 font-black text-white uppercase shadow-[4px_4px_0_0_#000]"
                  >
                    {reportLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Generate Report"
                    )}
                  </Button>
                </div>

                {reportError && (
                  <p className="text-sm font-black text-[#FF0000] uppercase">
                    {reportError}
                  </p>
                )}

                {reportResult && (
                  <div className="space-y-4">
                    {/* Report Header */}
                    <div className="neo-card border-4 border-black bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-5 text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-black tracking-widest text-[#9C27B0] uppercase">
                            {"//"} Generated Report
                          </p>
                          <div className="mt-2 flex gap-2">
                            <Badge className="neo-pill border-2 border-white/30 bg-[#9C27B0] text-xs font-black text-white uppercase">
                              {reportResult.channel}
                            </Badge>
                            <Badge className={`neo-pill border-2 border-white/30 text-xs font-black uppercase ${
                              reportResult.risk_level === "clean" || reportResult.risk_level === "low"
                                ? "bg-[#00FF00] text-black"
                                : reportResult.risk_level === "moderate"
                                  ? "bg-[#FFFF00] text-black"
                                  : "bg-[#FF0000] text-white"
                            }`}>
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
                      <p className="text-xs font-black tracking-widest text-black/60 uppercase">
                        {"//"} Message Content
                      </p>
                      <div className="mt-3 whitespace-pre-wrap rounded border-2 border-black/20 bg-gray-50 p-4 font-mono text-sm">
                        {reportResult.message}
                      </div>
                    </div>

                    {/* Recommended Actions */}
                    {reportResult.actions.length > 0 && (
                      <div className="neo-card border-4 border-black bg-[#E3F2FD] p-5">
                        <p className="text-xs font-black tracking-widest text-black/60 uppercase">
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
                      Generated at {new Date(reportResult.generated_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* COMMAND CENTER - Stats & Monitoring Dashboard */}
        <div id="ui" className="mt-8 grid gap-8 lg:grid-cols-4">
          <div className="space-y-8 lg:col-span-3">
            {/* STATS GRID - Industrial Gauges */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "TOTAL COVERAGE",
                  value: formatUSD(mockSummary.totalValueUSD),
                  tone: "bg-slate-100",
                  icon: <ShieldCheck className="h-5 w-5 text-slate-600" strokeWidth={2.5} />,
                },
                {
                  label: "TX / 24H",
                  value: mockSummary.dailyTx.toLocaleString(),
                  tone: "bg-slate-100",
                  icon: <Zap className="h-5 w-5 text-slate-600" strokeWidth={2.5} />,
                },
                {
                  label: "OPEN ALERTS",
                  value: mockSummary.openAlerts,
                  tone: "bg-red-50",
                  icon: <BellRing className="h-5 w-5 text-red-600" strokeWidth={2.5} />,
                },
                {
                  label: "HIGH RISK",
                  value: mockSummary.highRiskWallets,
                  tone: "bg-amber-50",
                  icon: <Radar className="h-5 w-5 text-amber-600" strokeWidth={2.5} />,
                },
              ].map((stat) => (
                <Card
                  key={stat.label}
                  className={`neo-card ${stat.tone} border-black`}
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-[10px] font-bold tracking-wider uppercase text-slate-600 truncate">
                      {stat.label}
                    </CardTitle>
                    <div className="shrink-0">{stat.icon}</div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-black truncate">{stat.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* MONITORED WALLETS TABLE */}
            <Card className="neo-card border-black bg-white">
              <CardHeader className="flex flex-row items-start justify-between gap-4 border-b-4 border-black pb-6">
                <div>
                  <CardTitle className="text-2xl font-black tracking-wide uppercase">
                    Monitored Wallets
                  </CardTitle>
                  <CardDescription className="mt-1 font-medium text-black/70">
                    Real-time balance and risk monitoring.
                  </CardDescription>
                </div>
                <Badge className="neo-pill border-4 border-black bg-[#FF0000] font-black text-white uppercase shadow-[6px_6px_0_0_#000]">
                  {mockSummary.anomalies24h} Anomalies
                </Badge>
              </CardHeader>
              <CardContent className="mt-6 overflow-hidden border-4 border-black bg-white px-0">
                <Table>
                  <TableHeader className="bg-black">
                    <TableRow className="border-black hover:bg-black">
                      <TableHead className="text-xs font-black tracking-wider text-[#FFFF00] uppercase">
                        Label
                      </TableHead>
                      <TableHead className="text-xs font-black tracking-wider text-[#FFFF00] uppercase">
                        Address
                      </TableHead>
                      <TableHead className="text-xs font-black tracking-wider text-[#FFFF00] uppercase">
                        Balance
                      </TableHead>
                      <TableHead className="text-xs font-black tracking-wider text-[#FFFF00] uppercase">
                        Risk
                      </TableHead>
                      <TableHead className="text-xs font-black tracking-wider text-[#FFFF00] uppercase">
                        Chain
                      </TableHead>
                      <TableHead className="text-xs font-black tracking-wider text-[#FFFF00] uppercase">
                        Last Active
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockWallets.map((wallet, i) => {
                      const explorerUrl = wallet.chains[0] === "Ethereum" 
                        ? `https://etherscan.io/address/${wallet.address}`
                        : wallet.chains[0] === "Neo N3"
                          ? `https://neotube.io/address/${wallet.address}`
                          : undefined;
                      return (
                        <TableRow
                          key={wallet.address}
                          className={`border-b-2 border-black ${i % 2 === 0 ? "bg-white" : "bg-[#F5F5F5]"} ${wallet.riskScore >= 70 ? "bg-[#FFE5E5]" : ""}`}
                        >
                          <TableCell className="font-black text-black">
                            <div className="flex flex-wrap gap-1">
                              {wallet.label}
                              {wallet.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className={`text-xs px-1.5 py-0.5 border border-black/30 ${
                                    tag === "exploited" || tag === "high-risk" || tag === "controversial"
                                      ? "bg-[#FF0000] text-white"
                                      : tag === "trusted" || tag === "regulated"
                                        ? "bg-[#00FF00] text-black"
                                        : "bg-gray-200 text-black"
                                  }`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-black">
                            <div className="flex items-center gap-2">
                              <span title={wallet.address}>
                                {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                              </span>
                              {explorerUrl && (
                                <a
                                  href={explorerUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#00BFFF] hover:underline"
                                >
                                  View
                                </a>
                              )}
                            </div>
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
                          <TableCell className="text-xs font-bold text-black uppercase">
                            {wallet.chains.join(", ")}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-black/70">
                            {new Intl.DateTimeFormat("en", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }).format(new Date(wallet.lastActive))}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* ALERTS INBOX - Industrial Warning System */}
            <Card className="neo-card border-black bg-white">
              <CardHeader className="flex flex-row items-start justify-between gap-4 border-b-4 border-black pb-6">
                <div>
                  <CardTitle className="text-2xl font-black tracking-wide uppercase">
                    Threat Inbox
                  </CardTitle>
                  <CardDescription className="mt-1 font-medium text-black/70">
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
                <Badge className="neo-pill border-4 border-black bg-[#FF0000] font-black text-white uppercase shadow-[6px_6px_0_0_#000]">
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
                      <div className="danger-stripes-thin absolute inset-x-0 top-0 h-3" />
                    )}
                    {alert.severity !== "critical" && (
                      <div className="absolute inset-x-0 top-0 h-2 bg-black" />
                    )}

                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className={`neo-pill ${severityBadge(alert.severity)} severity-stamp border-3 border-black px-4 py-1 text-xs uppercase shadow-[4px_4px_0_0_#000]`}
                          >
                            {alert.severity}
                          </span>
                          <span
                            className={`neo-pill ${statusBadge(alert.status)} border-3 border-black px-4 py-1 text-xs uppercase shadow-[4px_4px_0_0_#000]`}
                          >
                            {alert.status}
                          </span>
                          <span className="neo-pill border-3 border-black bg-[#00BFFF] px-4 py-1 text-xs font-black text-black uppercase shadow-[4px_4px_0_0_#000]">
                            {alert.chain}
                          </span>
                        </div>
                        <h3 className="flex items-center gap-3 text-xl font-black tracking-wide text-black uppercase">
                          <AlertTriangle className="h-6 w-6" strokeWidth={3} />
                          {alert.title}
                        </h3>
                        <div className="space-y-1">
                          <p className="font-mono text-xs tracking-wider text-black/60 uppercase">
                            ID: {alert.id}
                          </p>
                          <p className="font-mono text-xs text-black/80 break-all">
                            {alert.walletAddress}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <span className="border-4 border-black bg-white px-3 py-2 font-mono text-xs font-black text-black shadow-[4px_4px_0_0_#000]">
                          {new Intl.DateTimeFormat("en", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }).format(new Date(alert.createdAt))}
                        </span>
                        {alert.status !== "closed" && (
                          <Badge className="neo-pill animate-pulse border-4 border-black bg-[#FFFF00] font-black text-black uppercase shadow-[4px_4px_0_0_#000]">
                            Action Required
                          </Badge>
                        )}
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-relaxed font-medium text-black">
                      {alert.description}
                    </p>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t-4 border-black pt-4">
                      <div className="flex-1">
                        <p className="text-xs font-black tracking-widest text-black/60 uppercase">
                          {"//"} Recommended Action
                        </p>
                        <p className="mt-1 text-sm font-black text-black uppercase">
                          {alert.action}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {/* Voice Alert Button */}
                        <Button
                          size="sm"
                          onClick={() => {
                            const severityMap: Record<string, "info" | "warning" | "critical" | "emergency"> = {
                              low: "info",
                              medium: "warning",
                              high: "critical",
                              critical: "emergency",
                            };
                            voice.speakAlert(
                              `${alert.title}. ${alert.description}. Recommended action: ${alert.action}`,
                              severityMap[alert.severity] ?? "warning",
                              alert.walletAddress
                            );
                          }}
                          disabled={!voice.config.enabled || voice.isSpeaking}
                          className={`neo-button border-4 border-black px-4 font-black tracking-wider uppercase shadow-[4px_4px_0_0_#000] transition-none hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_0_#000] ${
                            voice.config.enabled 
                              ? "bg-[#00FF00] text-black" 
                              : "bg-gray-300 text-black/50"
                          }`}
                          title={voice.config.enabled ? "Listen to this alert" : "Enable voice to listen"}
                        >
                          <Volume2 className="h-4 w-4" strokeWidth={3} />
                        </Button>
                        {alert.explorerUrl && (
                          <Button
                            size="sm"
                            asChild
                            className="neo-button border-4 border-black bg-[#00BFFF] px-4 font-black tracking-wider text-black uppercase shadow-[4px_4px_0_0_#000] transition-none hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_0_#000]"
                          >
                            <a href={alert.explorerUrl} target="_blank" rel="noreferrer">
                              Explorer
                            </a>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="neo-button border-4 border-black bg-black px-6 font-black tracking-wider text-white uppercase shadow-[6px_6px_0_0_#FFFF00] transition-none hover:translate-x-1 hover:translate-y-1 hover:shadow-[3px_3px_0_0_#FFFF00] active:translate-x-2 active:translate-y-2 active:shadow-none"
                        >
                          Investigate
                        </Button>
                      </div>
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
              <CardHeader className="border-b-4 border-black pb-4">
                <CardTitle className="text-lg font-black tracking-wider uppercase">
                  {"//"} Live Feed
                </CardTitle>
                <CardDescription className="text-xs font-medium tracking-wide text-black/60 uppercase">
                  Real-time transaction stream
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <ScrollArea className="h-[400px] pr-2">
                  <div className="space-y-4">
                    {activities.map((tx) => (
                      <div
                        key={tx.id ?? tx.hash}
                        className={`neo-card border-black px-4 py-4 text-sm ${
                          tx.riskFlag ? "bg-[#FFE5E5]" : "bg-[#F5F5F5]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-black tracking-wider uppercase ${
                            tx.type === "exploit" ? "text-[#FF0000]" : "text-black"
                          }`}>
                            {tx.type}
                          </span>
                          <span className="text-xs font-bold text-black/60 uppercase">
                            {tx.chain}
                          </span>
                        </div>
                        <p className="mt-1 text-lg font-black text-black">
                          {tx.tokenSymbol} {tx.amountUSD > 0 && `• ${formatUSD(tx.amountUSD)}`}
                        </p>
                        {tx.riskFlag && (
                          <p className="mt-2 flex items-center gap-1 text-xs font-black text-[#FF0000] uppercase">
                            <AlertTriangle className="h-3 w-3" /> {tx.riskFlag}
                          </p>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <p className="font-mono text-xs text-black/50">
                            {new Intl.DateTimeFormat("en", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }).format(new Date(tx.timestamp))}
                          </p>
                          {tx.explorerUrl && (
                            <a
                              href={tx.explorerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-black text-[#00BFFF] hover:underline"
                            >
                              View
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* BUILD PATH CARD */}
            <Card className="neo-card border-black bg-[#FFFF00]">
              <CardHeader className="border-b-4 border-black pb-4">
                <CardTitle className="text-lg font-black tracking-wider text-black uppercase">
                  {"//"} Build Path
                </CardTitle>
                <CardDescription className="text-xs font-medium text-black/70 uppercase">
                  Implementation roadmap
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-4 text-sm text-black">
                <p className="flex items-center gap-2 font-bold">
                  <span className="bg-black px-2 py-0.5 font-mono text-xs text-[#FFFF00]">
                    01
                  </span>{" "}
                  Scorecards from /api/summary
                </p>
                <p className="flex items-center gap-2 font-bold">
                  <span className="bg-black px-2 py-0.5 font-mono text-xs text-[#FFFF00]">
                    02
                  </span>{" "}
                  Wallet table with filters
                </p>
                <p className="flex items-center gap-2 font-bold">
                  <span className="bg-black px-2 py-0.5 font-mono text-xs text-[#FFFF00]">
                    03
                  </span>{" "}
                  Alerts inbox with severity
                </p>
                <p className="flex items-center gap-2 font-bold">
                  <span className="bg-black px-2 py-0.5 font-mono text-xs text-[#FFFF00]">
                    04
                  </span>{" "}
                  Drilldown activity timelines
                </p>
                <p className="flex items-center gap-2 font-bold">
                  <span className="bg-black px-2 py-0.5 font-mono text-xs text-[#FFFF00]">
                    05
                  </span>{" "}
                  CTA buttons per alert
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>
    </main>
  );
}
