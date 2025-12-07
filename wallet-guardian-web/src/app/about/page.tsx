"use client"

import { motion, useScroll, useTransform } from "framer-motion"
import { useRef, useState, useCallback } from "react"
import {
  AnimatedSection,
  StaggerContainer,
  StaggerItem,
  GlitchText,
  FeatureCard,
  SimpleFlow,
  MultiChainArchitectureDiagram,
  OracleFlowDiagram,
  CodeShowcase,
  TerminalOutput,
  BonusCriteriaCard,
  PatternCard,
} from "~/components/presentation"

// API URL
const API_URL = "https://encode-spoonos-production.up.railway.app"

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
    return score < threshold`

// SpoonOS integration code
const spoonOSCode = `# SpoonOS Agent Integration
from spoon_ai.chat import ChatBot
from spoon_ai.agents import ToolCallAgent
from spoon_ai.tools import BaseTool, ToolManager

# Multi-provider LLM support
llm = ChatBot(
    llm_provider="openai",
    model_name="gpt-4o-mini",
)

# Custom tools built on BaseTool
class MaliciousContractDetectorTool(BaseTool):
    name = "malicious_contract_detector"
    description = "AI-powered contract scanner"
    
    def call(self, contract_address: str):
        # Pattern matching + AI analysis
        return scan_contract(contract_address)`

// Terminal output for contract scan
const scanTerminalLines = [
  { type: "command" as const, content: "curl /api/v2/contract-scan/0xbb9bc244d798123fde783fcc1c72d3bb8c189413" },
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
]

// Vulnerability patterns
const vulnerabilityPatterns = [
  { icon: "🍯", title: "HONEYPOT", examples: ["Hidden transfer restrictions", "Auto-blacklist buyers"], severity: "critical" as const },
  { icon: "🏃", title: "RUG PULL", examples: ["Unlimited minting", "Owner drain function"], severity: "critical" as const },
  { icon: "🔄", title: "REENTRANCY", examples: ["External call before state", "Missing guards"], severity: "critical" as const },
  { icon: "💸", title: "FEE MANIPULATION", examples: ["100% tax possible", "Hidden sell fees"], severity: "high" as const },
  { icon: "🔐", title: "ACCESS CONTROL", examples: ["Single owner", "No renounce"], severity: "medium" as const },
  { icon: "🔄", title: "PROXY RISK", examples: ["Upgradeable logic", "No timelock"], severity: "high" as const },
  { icon: "💀", title: "SELF-DESTRUCT", examples: ["selfdestruct call", "Funds lost forever"], severity: "critical" as const },
  { icon: "📞", title: "EXTERNAL CALL", examples: ["Unchecked returns", "Arbitrary calls"], severity: "high" as const },
]

// Live API scanner component
function LiveContractScanner() {
  const [address, setAddress] = useState("0xbb9bc244d798123fde783fcc1c72d3bb8c189413")
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scanContract = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/v2/contract-scan/${address}?chain=ethereum`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as Record<string, unknown>
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to scan")
    } finally {
      setLoading(false)
    }
  }, [address])

  return (
    <div className="neo-card overflow-hidden">
      <div className="bg-[var(--main)] px-4 py-3 border-b-4 border-border">
        <h4 className="font-heading text-black uppercase">TRY IT LIVE</h4>
      </div>
      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x... contract address"
            className="flex-1 px-3 py-2 border-4 border-border bg-background font-mono text-sm"
          />
          <motion.button
            onClick={scanContract}
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="neo-button bg-[var(--main)] text-black px-4"
          >
            {loading ? "..." : "SCAN"}
          </motion.button>
        </div>
        
        {/* Quick examples */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="opacity-60">Examples:</span>
          <button 
            onClick={() => setAddress("0xbb9bc244d798123fde783fcc1c72d3bb8c189413")}
            className="text-[var(--chart-4)] hover:underline"
          >
            The DAO
          </button>
          <button 
            onClick={() => setAddress("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")}
            className="text-[var(--severity-low)] hover:underline"
          >
            USDC (Safe)
          </button>
        </div>

        {/* Result */}
        {(result ?? error) && (
          <div className="bg-black p-3 font-mono text-xs text-white overflow-auto max-h-48">
            {error ? (
              <span className="text-[var(--severity-critical)]">Error: {error}</span>
            ) : result ? (
              <pre>{JSON.stringify(result, null, 2)}</pre>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AboutPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  })

  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"])

  return (
    <div ref={containerRef} className="min-h-screen bg-background">
      {/* Fixed progress bar */}
      <motion.div
        className="fixed top-0 left-0 h-2 bg-[var(--main)] z-50"
        style={{ width: progressWidth }}
      />

      {/* ========== HERO SECTION ========== */}
      <section className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4">
        <div className="absolute inset-0 grid-overlay opacity-50" />
        
        <motion.div 
          className="absolute top-0 left-0 right-0 h-4 danger-stripes"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />

        <div className="text-center z-10">
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-4 flex flex-wrap justify-center gap-2"
          >
            <span className="neo-pill text-xs bg-[var(--main)] text-black">ENCODE x SPOONOS 2025</span>
            <span className="neo-pill text-xs">AI AGENT WITH WEB3</span>
          </motion.div>

          <GlitchText className="font-heading text-5xl md:text-7xl lg:text-8xl uppercase tracking-tighter mb-6">
            WALLET GUARDIAN
          </GlitchText>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="text-xl md:text-2xl max-w-3xl mx-auto mb-8 opacity-80"
          >
            AI-powered multi-chain wallet security with{" "}
            <span className="text-[var(--main)] font-bold">on-chain risk scores</span> via Neo Oracle
          </motion.p>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="flex flex-wrap justify-center gap-8 mt-12"
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
                <div className="font-heading text-3xl md:text-4xl text-[var(--main)]">{stat.value}</div>
                <div className="text-xs uppercase tracking-widest opacity-60">{stat.label}</div>
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
              <span className="text-xs uppercase tracking-widest opacity-60">Scroll to explore</span>
              <div className="w-6 h-10 border-4 border-border rounded-full flex justify-center pt-2">
                <motion.div
                  animate={{ y: [0, 12, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-2 h-2 bg-[var(--main)]"
                />
              </div>
            </motion.div>
          </motion.div>
        </div>
        
        <motion.div 
          className="absolute bottom-0 left-0 right-0 h-4 danger-stripes"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
        />
      </section>

      {/* ========== KEY DIFFERENTIATOR 1: NEO ORACLE ========== */}
      <section className="min-h-screen flex items-center py-20 px-4 md:px-8 bg-secondary-background">
        <div className="max-w-6xl mx-auto w-full">
          <AnimatedSection variant="slam" className="mb-12 text-center">
            <span className="neo-pill text-xs mb-4 inline-block bg-[var(--main)] text-black">KEY DIFFERENTIATOR #1</span>
            <h2 className="font-heading text-4xl md:text-6xl uppercase tracking-tight">
              NEO <span className="text-[var(--main)]">ORACLE</span> CONTRACT
            </h2>
            <p className="text-lg opacity-60 mt-4 max-w-2xl mx-auto">
              On-chain risk scores via Neo&apos;s native Oracle service — trustless, decentralized security infrastructure
            </p>
          </AnimatedSection>

          {/* Oracle flow diagram */}
          <OracleFlowDiagram />

          <div className="grid lg:grid-cols-2 gap-8 mt-12">
            {/* Left: Explanation */}
            <AnimatedSection variant="slideLeft">
              <div className="neo-card p-6 h-full">
                <h3 className="font-heading text-2xl uppercase mb-4">WHY IT MATTERS</h3>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <span className="text-[var(--main)] text-xl">+</span>
                    <div>
                      <strong>Trustless Verification</strong>
                      <p className="text-sm opacity-70">Any smart contract can verify wallet risk without trusting external APIs</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-[var(--main)] text-xl">+</span>
                    <div>
                      <strong>Composable Security</strong>
                      <p className="text-sm opacity-70">DEXs, lending protocols, and dApps can integrate risk checks</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-[var(--main)] text-xl">+</span>
                    <div>
                      <strong>Permanent Record</strong>
                      <p className="text-sm opacity-70">Risk scores stored on-chain for audit and transparency</p>
                    </div>
                  </div>
                </div>

                {/* Use case example */}
                <div className="mt-6 p-4 bg-[var(--main)] border-4 border-border">
                  <h4 className="font-heading text-black uppercase text-sm mb-2">USE CASE</h4>
                  <p className="text-sm text-black">
                    A Neo DEX calls <code className="bg-black text-white px-1">is_risky(sender, 60)</code> before 
                    allowing trades — protecting users from interacting with flagged wallets.
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

      {/* ========== KEY DIFFERENTIATOR 2: MALICIOUS CONTRACT DETECTOR ========== */}
      <section className="min-h-screen flex items-center py-20 px-4 md:px-8">
        <div className="max-w-6xl mx-auto w-full">
          <AnimatedSection variant="glitch" className="mb-12 text-center">
            <span className="neo-pill text-xs mb-4 inline-block bg-[var(--chart-4)] text-white">KEY DIFFERENTIATOR #2</span>
            <h2 className="font-heading text-4xl md:text-6xl uppercase tracking-tight">
              AI-POWERED <span className="text-[var(--chart-4)]">CONTRACT SCANNER</span>
            </h2>
            <p className="text-lg opacity-60 mt-4 max-w-2xl mx-auto">
              Detect honeypots, rug pulls, and vulnerabilities with pattern matching + LLM deep analysis
            </p>
          </AnimatedSection>

          {/* Vulnerability pattern grid */}
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12" staggerDelay={0.05}>
            {vulnerabilityPatterns.map((pattern, index) => (
              <StaggerItem key={pattern.title}>
                <PatternCard {...pattern} index={index} />
              </StaggerItem>
            ))}
          </StaggerContainer>

          <div className="grid lg:grid-cols-2 gap-8">
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
            className="grid grid-cols-3 gap-4 mt-12"
          >
            <div className="neo-card p-4 text-center">
              <div className="font-heading text-3xl text-[var(--chart-4)]">20+</div>
              <div className="text-xs uppercase opacity-60">Regex Patterns</div>
            </div>
            <div className="neo-card p-4 text-center">
              <div className="font-heading text-3xl text-[var(--main)]">10+</div>
              <div className="text-xs uppercase opacity-60">Known Exploits</div>
            </div>
            <div className="neo-card p-4 text-center">
              <div className="font-heading text-3xl text-[var(--severity-low)]">AI</div>
              <div className="text-xs uppercase opacity-60">Deep Analysis</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========== SPOONOS INTEGRATION ========== */}
      <section className="min-h-screen flex items-center py-20 px-4 md:px-8 bg-secondary-background">
        <div className="max-w-6xl mx-auto w-full">
          <AnimatedSection variant="slam" className="mb-12 text-center">
            <span className="neo-pill text-xs mb-4 inline-block">BASELINE REQUIREMENTS</span>
            <h2 className="font-heading text-4xl md:text-6xl uppercase tracking-tight">
              SPOONOS <span className="text-[var(--main)]">INTEGRATION</span>
            </h2>
            <p className="text-lg opacity-60 mt-4 max-w-2xl mx-auto">
              Meeting both mandatory requirements: LLM via Spoon + Tools from spoon-toolkit
            </p>
          </AnimatedSection>

          <div className="grid lg:grid-cols-2 gap-8 mb-12">
            {/* Requirement 1 */}
            <AnimatedSection variant="slideLeft">
              <div className="neo-card overflow-hidden h-full">
                <div className="bg-[var(--severity-low)] px-4 py-2 border-b-4 border-border">
                  <span className="font-heading text-black uppercase">REQUIREMENT 1: LLM VIA SPOON</span>
                </div>
                <div className="p-4">
                  <p className="text-sm opacity-70 mb-4">
                    Multi-provider LLM support using <code>spoon_ai.chat.ChatBot</code>
                  </p>
                  <div className="font-mono text-xs bg-black text-white p-3">
                    <div><span className="text-[var(--main)]">from</span> spoon_ai.chat <span className="text-[var(--main)]">import</span> ChatBot</div>
                    <div className="mt-2">llm = ChatBot(</div>
                    <div className="pl-4">llm_provider=<span className="text-[var(--chart-5)]">&quot;openai&quot;</span>,</div>
                    <div className="pl-4">model_name=<span className="text-[var(--chart-5)]">&quot;gpt-4o-mini&quot;</span>,</div>
                    <div>)</div>
                  </div>
                  <div className="mt-3 text-xs opacity-50">
                    File: src/agent.py:101-119
                  </div>
                </div>
              </div>
            </AnimatedSection>

            {/* Requirement 2 */}
            <AnimatedSection variant="slideRight">
              <div className="neo-card overflow-hidden h-full">
                <div className="bg-[var(--severity-low)] px-4 py-2 border-b-4 border-border">
                  <span className="font-heading text-black uppercase">REQUIREMENT 2: TOOLS FROM SPOON-TOOLKIT</span>
                </div>
                <div className="p-4">
                  <p className="text-sm opacity-70 mb-4">
                    All 8 tools inherit from <code>spoon_ai.tools.BaseTool</code>
                  </p>
                  <div className="font-mono text-xs bg-black text-white p-3">
                    <div><span className="text-[var(--main)]">from</span> spoon_ai.tools <span className="text-[var(--main)]">import</span> BaseTool</div>
                    <div className="mt-2"><span className="text-[var(--main)]">class</span> <span className="text-[var(--chart-4)]">MaliciousContractDetectorTool</span>(BaseTool):</div>
                    <div className="pl-4">name = <span className="text-[var(--chart-5)]">&quot;malicious_contract_detector&quot;</span></div>
                    <div className="pl-4">...</div>
                  </div>
                  <div className="mt-3 text-xs opacity-50">
                    File: src/tools/malicious_contract_detector.py
                  </div>
                </div>
              </div>
            </AnimatedSection>
          </div>

          {/* Agent flow */}
          <AnimatedSection variant="slideUp">
            <div className="neo-card p-6">
              <h3 className="font-heading text-xl uppercase mb-4 text-center">AGENT INVOCATION FLOW</h3>
              <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-sm">
                <span className="neo-pill text-xs">User Query</span>
                <span className="opacity-50">→</span>
                <span className="neo-pill text-xs bg-[var(--main)] text-black">FastAPI</span>
                <span className="opacity-50">→</span>
                <span className="neo-pill text-xs bg-[var(--main)] text-black">ToolCallAgent</span>
                <span className="opacity-50">→</span>
                <span className="neo-pill text-xs bg-[var(--main)] text-black">ChatBot (LLM)</span>
                <span className="opacity-50">→</span>
                <span className="neo-pill text-xs">Tool Execution</span>
                <span className="opacity-50">→</span>
                <span className="neo-pill text-xs">Response</span>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ========== ARCHITECTURE ========== */}
      <section className="min-h-screen flex items-center py-20 px-4 md:px-8">
        <div className="max-w-7xl mx-auto w-full">
          <AnimatedSection variant="glitch" className="mb-12 text-center">
            <span className="neo-pill text-xs mb-4 inline-block">SYSTEM DESIGN</span>
            <h2 className="font-heading text-4xl md:text-6xl uppercase tracking-tight">
              MULTI-CHAIN <span className="text-[var(--main)]">ARCHITECTURE</span>
            </h2>
            <p className="text-lg opacity-60 mt-4 max-w-2xl mx-auto">
              Neo N3 + Ethereum support with Graph-based computation and x402 payments
            </p>
          </AnimatedSection>

          <MultiChainArchitectureDiagram />
        </div>
      </section>

      {/* ========== TOOLS ========== */}
      <section className="min-h-screen flex items-center py-20 px-4 md:px-8 bg-secondary-background">
        <div className="max-w-6xl mx-auto w-full">
          <AnimatedSection variant="slam" className="mb-12 text-center">
            <span className="neo-pill text-xs mb-4 inline-block">SPOONOS TOOLS</span>
            <h2 className="font-heading text-4xl md:text-6xl uppercase tracking-tight">
              8 AVAILABLE <span className="text-[var(--main)]">TOOLS</span>
            </h2>
          </AnimatedSection>

          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-4 gap-4" staggerDelay={0.08}>
            {[
              { name: "get_wallet_summary", desc: "Fetch balances, transfers, compute risk metrics" },
              { name: "wallet_validity_score", desc: "0-100 validity score with deductions" },
              { name: "flag_counterparty_risk", desc: "Label counterparties with risk tags" },
              { name: "malicious_contract_detector", desc: "AI-powered contract security scanner" },
              { name: "schedule_monitor", desc: "Real-time wallet monitoring" },
              { name: "multi_wallet_diff", desc: "Portfolio analysis with parallel execution" },
              { name: "approval_scan", desc: "Scan for risky contract approvals" },
              { name: "action_draft", desc: "Generate safe, non-advisory messaging" },
            ].map((tool) => (
              <StaggerItem key={tool.name}>
                <div className="neo-card-interactive p-4 h-full">
                  <div className="flex items-start justify-between mb-2">
                    <code className="text-xs font-mono text-[var(--main)]">{tool.name}</code>
                    <span className="text-xs uppercase px-2 py-1 border-2 border-border bg-[var(--severity-low)] text-black">
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

      {/* ========== BONUS CRITERIA ========== */}
      <section className="py-20 px-4 md:px-8">
        <div className="max-w-6xl mx-auto w-full">
          <AnimatedSection variant="glitch" className="mb-12 text-center">
            <span className="neo-pill text-xs mb-4 inline-block bg-[var(--chart-5)] text-black">EXTRA POINTS</span>
            <h2 className="font-heading text-4xl md:text-6xl uppercase tracking-tight">
              BONUS <span className="text-[var(--main)]">CRITERIA</span>
            </h2>
          </AnimatedSection>

          <StaggerContainer className="grid md:grid-cols-3 gap-6" staggerDelay={0.15}>
            <StaggerItem>
              <BonusCriteriaCard
                title="X402 INTEGRATION"
                status="implemented"
                evidence="server.py:223-258"
                description="Pay-per-invoke micropayments on Base Sepolia with 0.01 USDC per call"
                index={0}
              />
            </StaggerItem>
            <StaggerItem>
              <BonusCriteriaCard
                title="GRAPH TECHNOLOGIES"
                status="implemented"
                evidence="graph_orchestrator.py (1124 lines)"
                description="DAG-based computation graph with caching eliminates redundant RPC calls"
                index={1}
              />
            </StaggerItem>
            <StaggerItem>
              <BonusCriteriaCard
                title="NEO TECHNOLOGIES"
                status="implemented"
                evidence="Oracle contract + RPC + NEP-17"
                description="Neo N3 Oracle smart contract, JSON-RPC client, full NEP-17 support"
                index={2}
              />
            </StaggerItem>
          </StaggerContainer>
        </div>
      </section>

      {/* ========== x402 PAYMENTS ========== */}
      <section className="py-20 px-4 md:px-8 bg-secondary-background">
        <div className="max-w-6xl mx-auto w-full">
          <AnimatedSection variant="slam" className="mb-12 text-center">
            <span className="neo-pill text-xs mb-4 inline-block">MONETIZATION</span>
            <h2 className="font-heading text-4xl md:text-6xl uppercase tracking-tight">
              x402 <span className="text-[var(--main)]">PAYMENTS</span>
            </h2>
          </AnimatedSection>

          <div className="grid lg:grid-cols-2 gap-8">
            <AnimatedSection variant="slideLeft">
              <div className="neo-card p-6">
                <h3 className="font-heading text-xl uppercase mb-4">HOW IT WORKS</h3>
                <div className="space-y-4">
                  {[
                    { step: "01", title: "Request", desc: "Client calls /x402/invoke/{agent}" },
                    { step: "02", title: "402 Response", desc: "Server returns payment requirements" },
                    { step: "03", title: "Payment", desc: "Client signs USDC transfer on Base" },
                    { step: "04", title: "Execution", desc: "Agent runs, result returned" },
                  ].map((item, index) => (
                    <motion.div
                      key={item.step}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      viewport={{ once: true }}
                      className="flex items-start gap-3"
                    >
                      <div className="w-10 h-10 bg-[var(--main)] border-4 border-border flex items-center justify-center flex-shrink-0">
                        <span className="font-heading text-black text-sm">{item.step}</span>
                      </div>
                      <div>
                        <h4 className="font-heading uppercase text-sm">{item.title}</h4>
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
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 bg-[var(--chart-5)] border-4 border-border flex items-center justify-center">
                      <span className="text-2xl">💰</span>
                    </div>
                    <div>
                      <h4 className="font-heading text-2xl uppercase">0.01 USDC</h4>
                      <p className="text-sm opacity-60">Per API invocation</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm font-mono">
                    <div className="flex justify-between border-b border-border pb-2">
                      <span className="opacity-60">Network</span>
                      <span>Base Sepolia</span>
                    </div>
                    <div className="flex justify-between border-b border-border pb-2">
                      <span className="opacity-60">Asset</span>
                      <span>USDC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-60">Facilitator</span>
                      <span>x402.org</span>
                    </div>
                  </div>
                </div>

                <div className="neo-card p-4 bg-[var(--main)]">
                  <h4 className="font-heading uppercase text-black text-sm mb-2">IMPLEMENTATION STATUS</h4>
                  <p className="text-xs text-black">
                    Payment framework implemented. Verification accepts any header for demo purposes.
                    Production would verify signatures via x402 facilitator.
                  </p>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ========== CTA SECTION ========== */}
      <section className="min-h-[60vh] flex items-center justify-center py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 grid-overlay opacity-30" />
        <motion.div 
          className="absolute top-0 left-0 right-0 h-4 danger-stripes"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        />

        <div className="text-center z-10">
          <AnimatedSection variant="slam">
            <h2 className="font-heading text-4xl md:text-6xl lg:text-7xl uppercase tracking-tight mb-8">
              TRY <span className="text-[var(--main)]">WALLET GUARDIAN</span>
            </h2>
          </AnimatedSection>

          <AnimatedSection variant="slideUp" delay={200}>
            <p className="text-lg opacity-80 max-w-xl mx-auto mb-12">
              Multi-chain wallet security. Neo Oracle integration. AI-powered contract scanning.
            </p>
          </AnimatedSection>

          <AnimatedSection variant="slam" delay={400}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.a
                href="/"
                whileHover={{ scale: 1.02, x: 4, y: 4 }}
                whileTap={{ scale: 0.98 }}
                className="neo-button bg-[var(--main)] text-black inline-flex items-center gap-2"
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
          className="absolute bottom-0 left-0 right-0 h-4 danger-stripes"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        />
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="py-8 px-4 border-t-4 border-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="font-heading text-sm uppercase tracking-wider">
            WALLET GUARDIAN — ENCODE x SPOONOS HACKATHON 2025
          </div>
          <div className="text-sm opacity-60">
            Built with SpoonOS, Neo N3, Ethereum, x402
          </div>
        </div>
      </footer>
    </div>
  )
}
