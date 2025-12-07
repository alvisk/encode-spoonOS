"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState, useCallback } from "react";
import {
  AnimatedSection,
  StaggerContainer,
  StaggerItem,
  GlitchText,
  FeatureCard,
  MultiChainArchitectureDiagram,
  OracleFlowDiagram,
  CodeShowcase,
  TerminalOutput,
  PatternCard,
} from "~/components/presentation";

// API URL
const API_URL = "https://encode-spoonos-production.up.railway.app";

// Neo Oracle contract code
const oracleContractCode = `# Neo N3 Smart Contract (Python/boa3)
from boa3.sc.contracts import OracleContract

@public
def request_risk_score(address: str) -> bool:
    """Triggers Oracle to fetch score from API."""
    url = get_api_url() + address
    OracleContract.request(
        url, "$.score", 'oracle_callback', ...
    )
    return True

@public
def is_risky(address: str, threshold: int) -> bool:
    """Any dApp can call this before transactions."""
    score = get_risk_score(address)
    return score < threshold`;

// Terminal output for contract scan
const scanTerminalLines = [
  {
    type: "command" as const,
    content:
      "curl /api/v2/contract-scan/0xbb9bc244d798123fde783fcc1c72d3bb8c189413",
  },
  { type: "info" as const, content: "Scanning The DAO contract..." },
  { type: "success" as const, content: "Known malicious contract detected!" },
  { type: "output" as const, content: "" },
  { type: "output" as const, content: "VERDICT: CRITICAL (100/100)" },
  { type: "output" as const, content: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" },
  { type: "output" as const, content: "Category: reentrancy" },
  { type: "output" as const, content: "Exploit Date: 2016-06-17" },
  { type: "output" as const, content: "Amount Stolen: $60M (3.6M ETH)" },
  { type: "output" as const, content: "" },
  { type: "info" as const, content: "The DAO was exploited via reentrancy" },
  { type: "info" as const, content: "in the splitDAO function..." },
  { type: "output" as const, content: "" },
  { type: "error" as const, content: "RECOMMENDATION: DO NOT INTERACT" },
];

// Vulnerability patterns
const vulnerabilityPatterns = [
  {
    icon: "🍯",
    title: "HONEYPOT",
    examples: ["Hidden transfer restrictions", "Auto-blacklist buyers"],
    severity: "critical" as const,
  },
  {
    icon: "🏃",
    title: "RUG PULL",
    examples: ["Unlimited minting", "Owner drain function"],
    severity: "critical" as const,
  },
  {
    icon: "🔄",
    title: "REENTRANCY",
    examples: ["External call before state", "Missing guards"],
    severity: "critical" as const,
  },
  {
    icon: "💸",
    title: "FEE MANIPULATION",
    examples: ["100% tax possible", "Hidden sell fees"],
    severity: "high" as const,
  },
  {
    icon: "🔐",
    title: "ACCESS CONTROL",
    examples: ["Single owner", "No renounce"],
    severity: "medium" as const,
  },
  {
    icon: "🔄",
    title: "PROXY RISK",
    examples: ["Upgradeable logic", "No timelock"],
    severity: "high" as const,
  },
  {
    icon: "💀",
    title: "SELF-DESTRUCT",
    examples: ["selfdestruct call", "Funds lost forever"],
    severity: "critical" as const,
  },
  {
    icon: "📞",
    title: "EXTERNAL CALL",
    examples: ["Unchecked returns", "Arbitrary calls"],
    severity: "high" as const,
  },
];

// Live API scanner component
function LiveContractScanner() {
  const [address, setAddress] = useState(
    "0xbb9bc244d798123fde783fcc1c72d3bb8c189413",
  );
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scanContract = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/api/v2/contract-scan/${address}?chain=ethereum`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Record<string, unknown>;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to scan");
    } finally {
      setLoading(false);
    }
  }, [address]);

  return (
    <div className="neo-card overflow-hidden">
      <div className="border-border border-b-4 bg-[var(--main)] px-4 py-3">
        <h4 className="font-heading text-black uppercase">TRY IT LIVE</h4>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x... contract address"
            className="border-border bg-background flex-1 border-4 px-3 py-2 font-mono text-sm"
          />
          <motion.button
            onClick={scanContract}
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="neo-button bg-[var(--main)] px-4 text-black"
          >
            {loading ? "..." : "SCAN"}
          </motion.button>
        </div>

        {/* Quick examples */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="opacity-60">Examples:</span>
          <button
            onClick={() =>
              setAddress("0xbb9bc244d798123fde783fcc1c72d3bb8c189413")
            }
            className="text-[var(--chart-4)] hover:underline"
          >
            The DAO
          </button>
          <button
            onClick={() =>
              setAddress("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")
            }
            className="text-[var(--severity-low)] hover:underline"
          >
            USDC (Safe)
          </button>
        </div>

        {/* Result */}
        {(result ?? error) && (
          <div className="max-h-48 overflow-auto bg-black p-3 font-mono text-xs text-white">
            {error ? (
              <span className="text-[var(--severity-critical)]">
                Error: {error}
              </span>
            ) : result ? (
              <pre>{JSON.stringify(result, null, 2)}</pre>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AboutPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <div ref={containerRef} className="bg-background min-h-screen">
      {/* Fixed progress bar */}
      <motion.div
        className="fixed top-0 left-0 z-50 h-2 bg-[var(--main)]"
        style={{ width: progressWidth }}
      />

      {/* ========== HERO SECTION ========== */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
        <div className="grid-overlay absolute inset-0 opacity-50" />

        <motion.div
          className="danger-stripes absolute top-0 right-0 left-0 h-4"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />

        <div className="z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-4 flex flex-wrap justify-center gap-2"
          >
            <span className="neo-pill bg-[var(--main)] text-xs text-black">
              ENCODE x SPOONOS 2025
            </span>
            <span className="neo-pill text-xs">AI AGENT WITH WEB3</span>
          </motion.div>

          <GlitchText className="font-heading mb-6 text-5xl tracking-tighter uppercase md:text-7xl lg:text-8xl">
            ASSERTION OS
          </GlitchText>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="mx-auto mb-8 max-w-3xl text-xl opacity-80 md:text-2xl"
          >
            AI-powered multi-chain wallet security with{" "}
            <span className="font-bold text-[var(--main)]">
              on-chain risk scores
            </span>{" "}
            via Neo Oracle
          </motion.p>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="mt-12 flex flex-wrap justify-center gap-8"
          >
            {[
              { value: "8", label: "SPOONOS TOOLS" },
              { value: "NEO + ETH", label: "MULTI-CHAIN" },
              { value: "ORACLE", label: "ON-CHAIN" },
              { value: "AI", label: "CONTRACT SCANNER" },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 + index * 0.1 }}
                className="text-center"
              >
                <div className="font-heading text-3xl text-[var(--main)] md:text-4xl">
                  {stat.value}
                </div>
                <div className="text-xs tracking-widest uppercase opacity-60">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex flex-col items-center gap-2"
            >
              <span className="text-xs tracking-widest uppercase opacity-60">
                Scroll to explore
              </span>
              <div className="border-border flex h-10 w-6 justify-center rounded-full border-4 pt-2">
                <motion.div
                  animate={{ y: [0, 12, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="h-2 w-2 bg-[var(--main)]"
                />
              </div>
            </motion.div>
          </motion.div>
        </div>

        <motion.div
          className="danger-stripes absolute right-0 bottom-0 left-0 h-4"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
        />
      </section>

      {/* ========== NEO ORACLE ========== */}
      <section className="bg-secondary-background flex min-h-screen items-center px-4 py-20 md:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <AnimatedSection variant="slam" className="mb-12 text-center">
            <span className="neo-pill mb-4 inline-block bg-[var(--main)] text-xs text-black">
              ON-CHAIN SECURITY
            </span>
            <h2 className="font-heading text-4xl tracking-tight uppercase md:text-6xl">
              NEO <span className="text-[var(--main)]">ORACLE</span> CONTRACT
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg opacity-60">
              On-chain risk scores via Neo&apos;s native Oracle service —
              trustless, decentralized security infrastructure
            </p>
          </AnimatedSection>

          {/* Oracle flow diagram */}
          <OracleFlowDiagram />

          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            {/* Left: Explanation */}
            <AnimatedSection variant="slideLeft">
              <div className="neo-card h-full p-6">
                <h3 className="font-heading mb-4 text-2xl uppercase">
                  WHY IT MATTERS
                </h3>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <span className="text-xl text-[var(--main)]">+</span>
                    <div>
                      <strong>Trustless Verification</strong>
                      <p className="text-sm opacity-70">
                        Any smart contract can verify wallet risk without
                        trusting external APIs
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-xl text-[var(--main)]">+</span>
                    <div>
                      <strong>Composable Security</strong>
                      <p className="text-sm opacity-70">
                        DEXs, lending protocols, and dApps can integrate risk
                        checks
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-xl text-[var(--main)]">+</span>
                    <div>
                      <strong>Permanent Record</strong>
                      <p className="text-sm opacity-70">
                        Risk scores stored on-chain for audit and transparency
                      </p>
                    </div>
                  </div>
                </div>

                {/* Use case example */}
                <div className="border-border mt-6 border-4 bg-[var(--main)] p-4">
                  <h4 className="font-heading mb-2 text-sm text-black uppercase">
                    USE CASE
                  </h4>
                  <p className="text-sm text-black">
                    A Neo DEX calls{" "}
                    <code className="bg-black px-1 text-white">
                      is_risky(sender, 60)
                    </code>{" "}
                    before allowing trades — protecting users from interacting
                    with flagged wallets.
                  </p>
                </div>
              </div>
            </AnimatedSection>

            {/* Right: Contract code */}
            <AnimatedSection variant="slideRight">
              <CodeShowcase
                code={oracleContractCode}
                title="contracts/wallet_risk_oracle.py"
                language="python"
              />
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ========== CUSTOMER SEGMENTATION ========== */}
      <section className="px-4 py-20 md:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <AnimatedSection variant="slam" className="mb-8 text-center">
            <span className="neo-pill mb-4 inline-block bg-[var(--main)] text-xs text-black">
              WHO IT&apos;S FOR
            </span>
            <h2 className="font-heading text-4xl tracking-tight uppercase md:text-5xl">
              BUILT FOR <span className="text-[var(--main)]">EVERYONE</span>
            </h2>
          </AnimatedSection>

          <div className="grid gap-6 md:grid-cols-2">
            {/* dApps Card */}
            <AnimatedSection variant="slideLeft">
              <div className="neo-card h-full overflow-hidden">
                <div className="border-border flex items-center gap-2 border-b-4 bg-[var(--chart-4)] px-4 py-2">
                  <span className="text-xl">🏗️</span>
                  <h3 className="font-heading text-white uppercase">
                    dApps & DEVELOPERS
                  </h3>
                </div>
                <div className="p-4">
                  <div className="mb-4 grid grid-cols-2 gap-3">
                    {[
                      { title: "DEXs", desc: "Block risky wallets pre-trade" },
                      { title: "Lending", desc: "Assess borrower risk scores" },
                      {
                        title: "NFT Markets",
                        desc: "Scan contracts before listing",
                      },
                      { title: "Wallets", desc: "Warn before signing" },
                    ].map((item) => (
                      <div key={item.title} className="text-xs">
                        <strong className="font-heading text-[var(--chart-4)] uppercase">
                          {item.title}
                        </strong>
                        <p className="opacity-80">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                  <div className="border-border border-2 bg-[var(--chart-4)] p-3 font-mono text-xs text-white">
                    <div>
                      • Oracle:{" "}
                      <span className="font-bold">
                        is_risky(addr, threshold)
                      </span>
                    </div>
                    <div>
                      • REST:{" "}
                      <span className="font-bold">/api/v2/contract-scan</span>
                    </div>
                  </div>
                </div>
              </div>
            </AnimatedSection>

            {/* Individuals Card */}
            <AnimatedSection variant="slideRight">
              <div className="neo-card h-full overflow-hidden">
                <div className="border-border flex items-center gap-2 border-b-4 bg-[var(--main)] px-4 py-2">
                  <span className="text-xl">👤</span>
                  <h3 className="font-heading text-black uppercase">
                    INDIVIDUALS
                  </h3>
                </div>
                <div className="p-4">
                  <div className="mb-4 grid grid-cols-2 gap-3">
                    {[
                      { title: "Monitor", desc: "Track wallets across chains" },
                      { title: "Scan", desc: "Check contracts before use" },
                      { title: "Approvals", desc: "Manage token permissions" },
                      { title: "Analyze", desc: "Assess counterparty risk" },
                    ].map((item) => (
                      <div key={item.title} className="text-xs">
                        <strong className="font-heading text-[var(--main)] uppercase">
                          {item.title}
                        </strong>
                        <p className="opacity-80">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                  <div className="border-border border-2 bg-[var(--main)] p-3 font-mono text-xs font-bold text-black">
                    <div>• Web Dashboard • CLI</div>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ========== MALICIOUS CONTRACT DETECTOR ========== */}
      <section className="bg-secondary-background flex min-h-screen items-center px-4 py-20 md:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <AnimatedSection variant="glitch" className="mb-12 text-center">
            <span className="neo-pill mb-4 inline-block bg-[var(--chart-4)] text-xs text-white">
              AI SECURITY
            </span>
            <h2 className="font-heading text-4xl tracking-tight uppercase md:text-6xl">
              MALICIOUS{" "}
              <span className="text-[var(--chart-4)]">CONTRACT SCANNER</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg opacity-60">
              Detect honeypots, rug pulls, and vulnerabilities with pattern
              matching + LLM deep analysis
            </p>
          </AnimatedSection>

          {/* Vulnerability pattern grid */}
          <StaggerContainer
            className="mb-12 grid grid-cols-2 gap-3 md:grid-cols-4"
            staggerDelay={0.05}
          >
            {vulnerabilityPatterns.map((pattern, index) => (
              <StaggerItem key={pattern.title}>
                <PatternCard {...pattern} index={index} />
              </StaggerItem>
            ))}
          </StaggerContainer>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Left: Terminal demo */}
            <AnimatedSection variant="slideLeft">
              <TerminalOutput
                lines={scanTerminalLines}
                title="malicious-contract-scanner"
              />
            </AnimatedSection>

            {/* Right: Live scanner */}
            <AnimatedSection variant="slideRight">
              <LiveContractScanner />
            </AnimatedSection>
          </div>

          {/* Bottom: Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="mt-12 grid grid-cols-3 gap-4"
          >
            <div className="neo-card p-4 text-center">
              <div className="font-heading text-3xl text-[var(--chart-4)]">
                20+
              </div>
              <div className="text-xs uppercase opacity-60">Regex Patterns</div>
            </div>
            <div className="neo-card p-4 text-center">
              <div className="font-heading text-3xl text-[var(--main)]">
                10+
              </div>
              <div className="text-xs uppercase opacity-60">Known Exploits</div>
            </div>
            <div className="neo-card p-4 text-center">
              <div className="font-heading text-3xl text-[var(--severity-low)]">
                AI
              </div>
              <div className="text-xs uppercase opacity-60">Deep Analysis</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========== SPOONOS POWERED ========== */}
      <section className="bg-secondary-background flex min-h-screen items-center px-4 py-20 md:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <AnimatedSection variant="slam" className="mb-12 text-center">
            <span className="neo-pill mb-4 inline-block text-xs">
              POWERED BY
            </span>
            <h2 className="font-heading text-4xl tracking-tight uppercase md:text-6xl">
              SPOONOS <span className="text-[var(--main)]">FRAMEWORK</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg opacity-60">
              Built on SpoonOS for AI orchestration, multi-provider LLM support,
              and extensible tool architecture
            </p>
          </AnimatedSection>

          <div className="mb-12 grid gap-8 lg:grid-cols-2">
            {/* LLM Integration */}
            <AnimatedSection variant="slideLeft">
              <div className="neo-card h-full overflow-hidden">
                <div className="border-border border-b-4 bg-[var(--main)] px-4 py-2">
                  <span className="font-heading text-black uppercase">
                    MULTI-PROVIDER LLM
                  </span>
                </div>
                <div className="p-4">
                  <p className="mb-4 text-sm opacity-70">
                    Seamlessly switch between OpenAI, Anthropic, or Gemini with
                    a single config change
                  </p>
                  <div className="bg-black p-3 font-mono text-xs text-white">
                    <div>
                      <span className="text-[var(--main)]">from</span>{" "}
                      spoon_ai.chat{" "}
                      <span className="text-[var(--main)]">import</span> ChatBot
                    </div>
                    <div className="mt-2">llm = ChatBot(</div>
                    <div className="pl-4">
                      llm_provider=
                      <span className="text-[var(--chart-5)]">
                        &quot;openai&quot;
                      </span>
                      ,
                    </div>
                    <div className="pl-4">
                      model_name=
                      <span className="text-[var(--chart-5)]">
                        &quot;gpt-4o-mini&quot;
                      </span>
                      ,
                    </div>
                    <div>)</div>
                  </div>
                </div>
              </div>
            </AnimatedSection>

            {/* Tool Architecture */}
            <AnimatedSection variant="slideRight">
              <div className="neo-card h-full overflow-hidden">
                <div className="border-border border-b-4 bg-[var(--main)] px-4 py-2">
                  <span className="font-heading text-black uppercase">
                    EXTENSIBLE TOOLS
                  </span>
                </div>
                <div className="p-4">
                  <p className="mb-4 text-sm opacity-70">
                    Custom tools built on SpoonOS BaseTool for wallet analysis
                    and contract scanning
                  </p>
                  <div className="bg-black p-3 font-mono text-xs text-white">
                    <div>
                      <span className="text-[var(--main)]">from</span>{" "}
                      spoon_ai.tools{" "}
                      <span className="text-[var(--main)]">import</span>{" "}
                      BaseTool
                    </div>
                    <div className="mt-2">
                      <span className="text-[var(--main)]">class</span>{" "}
                      <span className="text-[var(--chart-4)]">
                        MaliciousContractDetectorTool
                      </span>
                      (BaseTool):
                    </div>
                    <div className="pl-4">
                      name ={" "}
                      <span className="text-[var(--chart-5)]">
                        &quot;malicious_contract_detector&quot;
                      </span>
                    </div>
                    <div className="pl-4">...</div>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          </div>

          {/* Agent flow */}
          <AnimatedSection variant="slideUp">
            <div className="neo-card p-6">
              <h3 className="font-heading mb-4 text-center text-xl uppercase">
                HOW THE AGENT WORKS
              </h3>
              <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-sm">
                <span className="neo-pill text-xs">User Query</span>
                <span className="opacity-50">→</span>
                <span className="neo-pill bg-[var(--main)] text-xs text-black">
                  FastAPI
                </span>
                <span className="opacity-50">→</span>
                <span className="neo-pill bg-[var(--main)] text-xs text-black">
                  ToolCallAgent
                </span>
                <span className="opacity-50">→</span>
                <span className="neo-pill bg-[var(--main)] text-xs text-black">
                  ChatBot (LLM)
                </span>
                <span className="opacity-50">→</span>
                <span className="neo-pill text-xs">Tool Execution</span>
                <span className="opacity-50">→</span>
                <span className="neo-pill text-xs">Response</span>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ========== SPOONOS SDK FEATURES ========== */}
      <section className="px-4 py-20 md:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <AnimatedSection variant="slam" className="mb-12 text-center">
            <span className="neo-pill mb-4 inline-block bg-[var(--chart-5)] text-xs text-black">
              SDK INTEGRATION
            </span>
            <h2 className="font-heading text-4xl tracking-tight uppercase md:text-6xl">
              SPOONOS <span className="text-[var(--main)]">SDK FEATURES</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg opacity-60">
              Built on the SpoonOS Core Developer Framework — the agentic OS for
              the sentient economy
            </p>
          </AnimatedSection>

          {/* Core Capabilities Grid */}
          <StaggerContainer
            className="mb-12 grid gap-6 md:grid-cols-2"
            staggerDelay={0.1}
          >
            {/* Agent Framework */}
            <StaggerItem>
              <div className="neo-card h-full overflow-hidden">
                <div className="border-border flex items-center gap-3 border-b-4 bg-[var(--main)] px-4 py-3">
                  <span className="text-2xl">🤖</span>
                  <h3 className="font-heading text-black uppercase">
                    AGENT FRAMEWORK
                  </h3>
                </div>
                <div className="p-5">
                  <p className="mb-4 text-sm">
                    Assertion OS uses SpoonOS&apos;s{" "}
                    <strong>ToolCallAgent</strong> and{" "}
                    <strong>SpoonReactAI</strong> for intelligent wallet
                    analysis. The ReAct pattern enables multi-step reasoning —
                    the agent thinks, acts, observes, and iterates until it
                    reaches a conclusion.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-[var(--main)]">→</span>
                      <span className="text-sm">
                        <strong>ToolCallAgent:</strong> Routes user queries to
                        the right tools automatically
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[var(--main)]">→</span>
                      <span className="text-sm">
                        <strong>SpoonReactAI:</strong> Handles complex
                        multi-step analysis with memory
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[var(--main)]">→</span>
                      <span className="text-sm">
                        <strong>Memory:</strong> Maintains conversation context
                        across interactions
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </StaggerItem>

            {/* Multi-Provider LLM */}
            <StaggerItem>
              <div className="neo-card h-full overflow-hidden">
                <div className="border-border flex items-center gap-3 border-b-4 bg-[var(--main)] px-4 py-3">
                  <span className="text-2xl">🧠</span>
                  <h3 className="font-heading text-black uppercase">
                    MULTI-PROVIDER LLM
                  </h3>
                </div>
                <div className="p-5">
                  <p className="mb-4 text-sm">
                    The <strong>ChatBot</strong> abstraction provides a unified
                    interface to multiple LLM providers. Switch between OpenAI,
                    Anthropic, or Google Gemini with a single configuration
                    change — no code modifications required.
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {["OpenAI", "Anthropic", "Gemini"].map((provider) => (
                      <div
                        key={provider}
                        className="border-border bg-secondary-background border-2 p-2 text-center"
                      >
                        <span className="font-heading text-xs uppercase">
                          {provider}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs opacity-60">
                    Automatic fallback chains ensure high availability if a
                    provider fails
                  </p>
                </div>
              </div>
            </StaggerItem>

            {/* Custom Tool System */}
            <StaggerItem>
              <div className="neo-card h-full overflow-hidden">
                <div className="border-border flex items-center gap-3 border-b-4 bg-[var(--chart-4)] px-4 py-3">
                  <span className="text-2xl">🔧</span>
                  <h3 className="font-heading text-white uppercase">
                    CUSTOM TOOL SYSTEM
                  </h3>
                </div>
                <div className="p-5">
                  <p className="mb-4 text-sm">
                    All 8 wallet analysis tools extend SpoonOS&apos;s{" "}
                    <strong>BaseTool</strong> class. This provides a
                    standardized interface for tool definition, parameter
                    validation, and execution — making tools discoverable and
                    callable by the AI agent.
                  </p>
                  <div className="bg-black p-3 font-mono text-xs text-[var(--main)]">
                    <div>BaseTool → GetWalletSummaryTool</div>
                    <div>BaseTool → WalletValidityScoreTool</div>
                    <div>BaseTool → MaliciousContractDetectorTool</div>
                    <div className="opacity-50">... + 5 more tools</div>
                  </div>
                  <p className="mt-3 text-xs opacity-60">
                    ToolManager registers and exposes tools to the agent at
                    runtime
                  </p>
                </div>
              </div>
            </StaggerItem>

            {/* x402 Payments */}
            <StaggerItem>
              <div className="neo-card h-full overflow-hidden">
                <div className="border-border flex items-center gap-3 border-b-4 bg-[var(--chart-4)] px-4 py-3">
                  <span className="text-2xl">💳</span>
                  <h3 className="font-heading text-white uppercase">
                    x402 PAYMENT RAILS
                  </h3>
                </div>
                <div className="p-5">
                  <p className="mb-4 text-sm">
                    SpoonOS includes first-class support for{" "}
                    <strong>x402 micropayments</strong>. The payment service
                    handles 402 challenges, signature verification, and
                    settlement — enabling pay-per-invoke monetization for AI
                    agents.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-[var(--chart-4)]">→</span>
                      <span className="text-sm">
                        <strong>X402PaymentService:</strong> Manages payment
                        lifecycle
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[var(--chart-4)]">→</span>
                      <span className="text-sm">
                        <strong>create_paywalled_router:</strong> FastAPI
                        integration
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[var(--chart-4)]">→</span>
                      <span className="text-sm">
                        <strong>0.01 USDC per call</strong> on Base Sepolia
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </StaggerItem>
          </StaggerContainer>

          {/* How It Fits Together */}
          <AnimatedSection variant="slideUp" className="mb-12">
            <div className="neo-card p-6">
              <h3 className="font-heading mb-4 text-center text-xl uppercase">
                HOW SPOONOS POWERS ASSERTION OS
              </h3>
              <div className="flex flex-wrap items-center justify-center gap-3 font-mono text-xs">
                <div className="neo-pill bg-secondary-background">
                  User Query
                </div>
                <span className="text-[var(--main)]">→</span>
                <div className="neo-pill bg-[var(--main)] text-black">
                  ChatBot (LLM)
                </div>
                <span className="text-[var(--main)]">→</span>
                <div className="neo-pill bg-[var(--main)] text-black">
                  ToolCallAgent
                </div>
                <span className="text-[var(--main)]">→</span>
                <div className="neo-pill bg-[var(--chart-4)] text-white">
                  BaseTool × 8
                </div>
                <span className="text-[var(--main)]">→</span>
                <div className="neo-pill bg-secondary-background">
                  Analysis Result
                </div>
              </div>
              <p className="mt-4 text-center text-sm opacity-60">
                The agent receives a query, reasons about which tools to use,
                executes them, and synthesizes the results
              </p>
            </div>
          </AnimatedSection>

          {/* Future Enhancements */}
          <AnimatedSection variant="slideUp">
            <div className="neo-card overflow-hidden">
              <div className="bg-secondary-background border-border border-b-4 px-4 py-3">
                <h3 className="font-heading text-sm uppercase">
                  ADDITIONAL SPOONOS CAPABILITIES (FUTURE ROADMAP)
                </h3>
              </div>
              <div className="p-4">
                <div className="grid gap-4 md:grid-cols-4">
                  {[
                    {
                      name: "MCP Protocol",
                      desc: "Model Context Protocol enables dynamic tool discovery at runtime — agents can find and use tools without hardcoding",
                      icon: "🔌",
                    },
                    {
                      name: "StateGraph",
                      desc: "DAG-based workflow orchestration with checkpointing, human-in-the-loop, and multi-agent coordination",
                      icon: "📊",
                    },
                    {
                      name: "Prompt Caching",
                      desc: "Anthropic prompt caching reduces token costs and latency for repeated system prompts",
                      icon: "⚡",
                    },
                    {
                      name: "Turnkey SDK",
                      desc: "Secure key management for blockchain transactions — sign without exposing private keys",
                      icon: "🔐",
                    },
                  ].map((feature) => (
                    <div
                      key={feature.name}
                      className="border-border border-2 p-4 transition-colors hover:border-[var(--main)]"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-xl">{feature.icon}</span>
                        <span className="font-heading text-sm uppercase">
                          {feature.name}
                        </span>
                      </div>
                      <p className="text-xs opacity-70">{feature.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ========== ARCHITECTURE ========== */}
      <section className="flex min-h-screen items-center px-4 py-20 md:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <AnimatedSection variant="glitch" className="mb-12 text-center">
            <span className="neo-pill mb-4 inline-block text-xs">
              SYSTEM DESIGN
            </span>
            <h2 className="font-heading text-4xl tracking-tight uppercase md:text-6xl">
              MULTI-CHAIN{" "}
              <span className="text-[var(--main)]">ARCHITECTURE</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg opacity-60">
              Neo N3 + Ethereum support with Graph-based computation and x402
              payments
            </p>
          </AnimatedSection>

          <MultiChainArchitectureDiagram />
        </div>
      </section>

      {/* ========== TOOLS ========== */}
      <section className="bg-secondary-background flex min-h-screen items-center px-4 py-20 md:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <AnimatedSection variant="slam" className="mb-12 text-center">
            <span className="neo-pill mb-4 inline-block text-xs">
              SPOONOS TOOLS
            </span>
            <h2 className="font-heading text-4xl tracking-tight uppercase md:text-6xl">
              8 AVAILABLE <span className="text-[var(--main)]">TOOLS</span>
            </h2>
          </AnimatedSection>

          <StaggerContainer
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
            staggerDelay={0.08}
          >
            {[
              {
                name: "get_wallet_summary",
                desc: "Fetch balances, transfers, compute risk metrics",
              },
              {
                name: "wallet_validity_score",
                desc: "0-100 validity score with deductions",
              },
              {
                name: "flag_counterparty_risk",
                desc: "Label counterparties with risk tags",
              },
              {
                name: "malicious_contract_detector",
                desc: "AI-powered contract security scanner",
              },
              { name: "schedule_monitor", desc: "Real-time wallet monitoring" },
              {
                name: "multi_wallet_diff",
                desc: "Portfolio analysis with parallel execution",
              },
              {
                name: "approval_scan",
                desc: "Scan for risky contract approvals",
              },
              {
                name: "action_draft",
                desc: "Generate safe, non-advisory messaging",
              },
            ].map((tool) => (
              <StaggerItem key={tool.name}>
                <div className="neo-card-interactive h-full p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <code className="font-mono text-xs text-[var(--main)]">
                      {tool.name}
                    </code>
                    <span className="border-border border-2 bg-[var(--severity-low)] px-2 py-1 text-xs text-black uppercase">
                      LIVE
                    </span>
                  </div>
                  <p className="text-xs opacity-70">{tool.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ========== ADVANCED FEATURES ========== */}
      <section className="px-4 py-20 md:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <AnimatedSection variant="glitch" className="mb-12 text-center">
            <span className="neo-pill mb-4 inline-block bg-[var(--chart-5)] text-xs text-black">
              DEEP INTEGRATION
            </span>
            <h2 className="font-heading text-4xl tracking-tight uppercase md:text-6xl">
              ADVANCED <span className="text-[var(--main)]">FEATURES</span>
            </h2>
          </AnimatedSection>

          <StaggerContainer
            className="grid gap-6 md:grid-cols-3"
            staggerDelay={0.15}
          >
            <StaggerItem>
              <FeatureCard
                icon="💳"
                title="x402 PAYMENTS"
                description="Pay-per-invoke micropayments on Base Sepolia. Monetize AI agents with 0.01 USDC per call."
                color="yellow"
                index={0}
              />
            </StaggerItem>
            <StaggerItem>
              <FeatureCard
                icon="🔀"
                title="GRAPH ORCHESTRATION"
                description="DAG-based computation eliminates redundant RPC calls. Parallel execution with intelligent caching."
                color="blue"
                index={1}
              />
            </StaggerItem>
            <StaggerItem>
              <FeatureCard
                icon="⛓️"
                title="NEO N3 NATIVE"
                description="Oracle smart contract, JSON-RPC client, full NEP-17 token support. True blockchain integration."
                color="teal"
                index={2}
              />
            </StaggerItem>
          </StaggerContainer>
        </div>
      </section>

      {/* ========== x402 PAYMENTS ========== */}
      <section className="bg-secondary-background px-4 py-20 md:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <AnimatedSection variant="slam" className="mb-12 text-center">
            <span className="neo-pill mb-4 inline-block text-xs">
              MONETIZATION
            </span>
            <h2 className="font-heading text-4xl tracking-tight uppercase md:text-6xl">
              x402 <span className="text-[var(--main)]">PAYMENTS</span>
            </h2>
          </AnimatedSection>

          <div className="grid gap-8 lg:grid-cols-2">
            <AnimatedSection variant="slideLeft">
              <div className="neo-card p-6">
                <h3 className="font-heading mb-4 text-xl uppercase">
                  HOW IT WORKS
                </h3>
                <div className="space-y-4">
                  {[
                    {
                      step: "01",
                      title: "Request",
                      desc: "Client calls /x402/invoke/{agent}",
                    },
                    {
                      step: "02",
                      title: "402 Response",
                      desc: "Server returns payment requirements",
                    },
                    {
                      step: "03",
                      title: "Payment",
                      desc: "Client signs USDC transfer on Base",
                    },
                    {
                      step: "04",
                      title: "Execution",
                      desc: "Agent runs, result returned",
                    },
                  ].map((item, index) => (
                    <motion.div
                      key={item.step}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      viewport={{ once: true }}
                      className="flex items-start gap-3"
                    >
                      <div className="border-border flex h-10 w-10 flex-shrink-0 items-center justify-center border-4 bg-[var(--main)]">
                        <span className="font-heading text-sm text-black">
                          {item.step}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-heading text-sm uppercase">
                          {item.title}
                        </h4>
                        <p className="text-xs opacity-70">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection variant="slideRight">
              <div className="space-y-4">
                <div className="neo-card p-6">
                  <div className="mb-4 flex items-center gap-4">
                    <div className="border-border flex h-14 w-14 items-center justify-center border-4 bg-[var(--chart-5)]">
                      <span className="text-2xl">💰</span>
                    </div>
                    <div>
                      <h4 className="font-heading text-2xl uppercase">
                        0.01 USDC
                      </h4>
                      <p className="text-sm opacity-60">Per API invocation</p>
                    </div>
                  </div>
                  <div className="space-y-2 font-mono text-sm">
                    <div className="border-border flex justify-between border-b pb-2">
                      <span className="opacity-60">Network</span>
                      <span>Base Sepolia</span>
                    </div>
                    <div className="border-border flex justify-between border-b pb-2">
                      <span className="opacity-60">Asset</span>
                      <span>USDC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-60">Facilitator</span>
                      <span>x402.org</span>
                    </div>
                  </div>
                </div>

                <div className="neo-card bg-[var(--main)] p-4">
                  <h4 className="font-heading mb-2 text-sm text-black uppercase">
                    IMPLEMENTATION STATUS
                  </h4>
                  <p className="text-xs text-black">
                    Payment framework implemented. Verification accepts any
                    header for demo purposes. Production would verify signatures
                    via x402 facilitator.
                  </p>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ========== CTA SECTION ========== */}
      <section className="relative flex min-h-[60vh] items-center justify-center overflow-hidden px-4 py-20">
        <div className="grid-overlay absolute inset-0 opacity-30" />
        <motion.div
          className="danger-stripes absolute top-0 right-0 left-0 h-4"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        />

        <div className="z-10 text-center">
          <AnimatedSection variant="slam">
            <h2 className="font-heading mb-8 text-4xl tracking-tight uppercase md:text-6xl lg:text-7xl">
              TRY <span className="text-[var(--main)]">ASSERTION OS</span>
            </h2>
          </AnimatedSection>

          <AnimatedSection variant="slideUp" delay={200}>
            <p className="mx-auto mb-12 max-w-xl text-lg opacity-80">
              Multi-chain wallet security. Neo Oracle integration. AI-powered
              contract scanning.
            </p>
          </AnimatedSection>

          <AnimatedSection variant="slam" delay={400}>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <motion.a
                href="/"
                whileHover={{ scale: 1.02, x: 4, y: 4 }}
                whileTap={{ scale: 0.98 }}
                className="neo-button inline-flex items-center gap-2 bg-[var(--main)] text-black"
              >
                LAUNCH APP
                <span>→</span>
              </motion.a>
              <motion.a
                href="https://github.com/alvisk/encode-spoonOS"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.02, x: 4, y: 4 }}
                whileTap={{ scale: 0.98 }}
                className="neo-button inline-flex items-center gap-2"
              >
                VIEW SOURCE
                <span>↗</span>
              </motion.a>
              <motion.a
                href={`${API_URL}/docs`}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.02, x: 4, y: 4 }}
                whileTap={{ scale: 0.98 }}
                className="neo-button inline-flex items-center gap-2"
              >
                API DOCS
                <span>↗</span>
              </motion.a>
            </div>
          </AnimatedSection>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            viewport={{ once: true }}
            className="mt-16 flex justify-center gap-8 opacity-40"
          >
            {["SPOONOS", "NEO N3", "ETHEREUM", "x402"].map((tech) => (
              <span key={tech} className="font-heading text-sm tracking-widest">
                {tech}
              </span>
            ))}
          </motion.div>
        </div>

        <motion.div
          className="danger-stripes absolute right-0 bottom-0 left-0 h-4"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        />
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="border-border border-t-4 px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="font-heading text-sm tracking-wider uppercase">
            ASSERTION OS — ENCODE x SPOONOS HACKATHON 2025
          </div>
          <div className="text-sm opacity-60">
            Built with SpoonOS, Neo N3, Ethereum, x402
          </div>
        </div>
      </footer>
    </div>
  );
}
