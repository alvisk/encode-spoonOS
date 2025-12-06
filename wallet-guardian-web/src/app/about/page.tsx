"use client"

import { motion, useScroll, useTransform } from "framer-motion"
import { useRef } from "react"
import {
  AnimatedSection,
  StaggerContainer,
  StaggerItem,
  GlitchText,
  FeatureCard,
  SimpleFlow,
  ArchitectureDiagram,
  CodeShowcase,
  TerminalOutput,
} from "~/components/presentation"

// Python code example
const agentCode = `from spoon_ai.agents import ToolCallAgent
from spoon_ai.tools import ToolManager

# Define the Assertion OS agent
class WalletGuardianAgent(ToolCallAgent):
    """AI Wallet Copilot for Neo N3"""
    
    tools = [
        GetWalletSummaryTool(),
        WalletValidityScoreTool(),
        FlagCounterpartyRiskTool(),
        ScheduleMonitorTool(),
    ]
    
    system_prompt = """
    You are an AI Wallet Copilot.
    Analyze wallets on Neo N3, surface 
    risks, and generate insights.
    """`

const toolCode = `class GetWalletSummaryTool(BaseTool):
    """Fetch wallet data from Neo N3"""
    
    name = "get_wallet_summary"
    description = "Analyze wallet balances and transfers"
    
    parameters = {
        "address": {"type": "string"},
        "chain": {"type": "string", "default": "neo3"}
    }
    
    def execute(self, address: str, chain: str):
        # Fetch from Neo RPC
        balances = neo_client.get_nep17_balances(address)
        transfers = neo_client.get_nep17_transfers(address)
        
        # Compute risk metrics
        return {
            "balances": balances,
            "concentration": self._compute_concentration(balances),
            "counterparties": len(set(transfers)),
            "risk_flags": self._analyze_risks(balances, transfers)
        }`

const terminalLines = [
  { type: "command" as const, content: "python -m wallet_guardian analyze NXV7ZhHi..." },
  { type: "info" as const, content: "Connecting to Neo N3 testnet..." },
  { type: "info" as const, content: "Fetching NEP-17 balances..." },
  { type: "info" as const, content: "Analyzing 24 transfers..." },
  { type: "success" as const, content: "Analysis complete!" },
  { type: "output" as const, content: "" },
  { type: "output" as const, content: "WALLET SUMMARY" },
  { type: "output" as const, content: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" },
  { type: "output" as const, content: "Address: NXV7ZhHiyM1aHXwp...jghXAq" },
  { type: "output" as const, content: "Total Assets: 3 tokens" },
  { type: "output" as const, content: "Validity Score: 78/100" },
  { type: "output" as const, content: "" },
  { type: "output" as const, content: "RISK FLAGS" },
  { type: "output" as const, content: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" },
  { type: "info" as const, content: "High concentration (>80%) in GAS" },
  { type: "info" as const, content: "Low stablecoin buffer (<10%)" },
]

export default function AboutPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  })

  // Progress bar transforms
  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"])

  return (
    <div ref={containerRef} className="min-h-screen bg-background">
      {/* Fixed progress bar */}
      <motion.div
        className="fixed top-0 left-0 h-2 bg-[var(--main)] z-50"
        style={{ width: progressWidth }}
      />

      {/* Hero Section */}
      <section className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4">
        {/* Background grid */}
        <div className="absolute inset-0 grid-overlay opacity-50" />
        
        {/* Animated danger stripe borders */}
        <motion.div 
          className="absolute top-0 left-0 right-0 h-4 danger-stripes"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        <motion.div 
          className="absolute bottom-0 left-0 right-0 h-4 danger-stripes"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
        />

        {/* Main title */}
        <div className="text-center z-10">
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-4"
          >
            <span className="neo-pill text-xs">AI AGENT FRAMEWORK</span>
          </motion.div>

          <GlitchText className="font-heading text-6xl md:text-8xl lg:text-9xl uppercase tracking-tighter mb-6">
            ASSERTION OS
          </GlitchText>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="text-xl md:text-2xl max-w-2xl mx-auto mb-8 opacity-80"
          >
            Build intelligent agents that interact with blockchains,
            analyze wallets, and execute payments — autonomously.
          </motion.p>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="flex flex-wrap justify-center gap-8 mt-12"
          >
            {[
              { value: "7", label: "TOOLS" },
              { value: "NEO N3", label: "BLOCKCHAIN" },
              { value: "0.01", label: "USDC/CALL" },
              { value: "x402", label: "PAYMENTS" },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 + index * 0.1 }}
                className="text-center"
              >
                <div className="font-heading text-4xl text-[var(--main)]">{stat.value}</div>
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
              <span className="text-xs uppercase tracking-widest opacity-60">Scroll</span>
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
      </section>

      {/* What It Is Section */}
      <section className="min-h-screen flex items-center py-20 px-4 md:px-8">
        <div className="max-w-6xl mx-auto w-full">
          <AnimatedSection variant="glitch" className="mb-12">
            <span className="neo-pill text-xs mb-4 inline-block">01</span>
            <h2 className="font-heading text-4xl md:text-6xl uppercase tracking-tight">
              WHAT IS <span className="text-[var(--main)]">ASSERTION OS</span>?
            </h2>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <AnimatedSection variant="slideLeft">
              <div className="space-y-6">
                <p className="text-lg leading-relaxed">
                  Assertion OS is a <strong>framework for building AI agents</strong> that 
                  autonomously interact with blockchain networks, execute tool calls, and 
                  make intelligent decisions.
                </p>
                <p className="text-lg leading-relaxed opacity-80">
                  Built on <span className="text-[var(--main)] font-bold">SpoonOS</span>, 
                  it provides a robust foundation for creating wallet analysis agents, 
                  automated trading systems, and blockchain monitoring tools.
                </p>

                {/* Feature list */}
                <ul className="space-y-4 mt-8">
                  {[
                    "Real-time blockchain data via Neo N3 RPC",
                    "AI-powered risk analysis and insights",
                    "x402 micropayments for monetization",
                    "Extensible tool-calling architecture",
                  ].map((item, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      viewport={{ once: true }}
                      className="flex items-start gap-3"
                    >
                      <span className="text-[var(--main)] text-xl">+</span>
                      <span>{item}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </AnimatedSection>

            <AnimatedSection variant="slideRight">
              <div className="neo-card p-8 relative">
                <div className="absolute -top-3 -right-3 w-24 h-24 bg-[var(--main)] border-4 border-border flex items-center justify-center"
                  style={{ boxShadow: "var(--shadow)" }}
                >
                  <span className="text-4xl">🤖</span>
                </div>
                <h3 className="font-heading text-2xl uppercase mb-4">THE AGENT</h3>
                <div className="space-y-3 font-mono text-sm">
                  <div className="flex justify-between border-b-2 border-border pb-2">
                    <span className="opacity-60">Type</span>
                    <span>ToolCallAgent</span>
                  </div>
                  <div className="flex justify-between border-b-2 border-border pb-2">
                    <span className="opacity-60">LLM</span>
                    <span>ChatBot (GPT-4)</span>
                  </div>
                  <div className="flex justify-between border-b-2 border-border pb-2">
                    <span className="opacity-60">Tools</span>
                    <span>7 Available</span>
                  </div>
                  <div className="flex justify-between border-b-2 border-border pb-2">
                    <span className="opacity-60">Chain</span>
                    <span>Neo N3</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-60">Payments</span>
                    <span>Base Sepolia (USDC)</span>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="min-h-screen flex items-center py-20 px-4 md:px-8 bg-secondary-background">
        <div className="max-w-6xl mx-auto w-full">
          <AnimatedSection variant="slam" className="mb-12 text-center">
            <span className="neo-pill text-xs mb-4 inline-block">02</span>
            <h2 className="font-heading text-4xl md:text-6xl uppercase tracking-tight">
              THE <span className="text-[var(--chart-4)]">PROBLEM</span>
            </h2>
          </AnimatedSection>

          <StaggerContainer className="grid md:grid-cols-3 gap-6" staggerDelay={0.15}>
            <StaggerItem>
              <div className="neo-card h-full">
                <div className="h-2 bg-[var(--chart-4)]" />
                <div className="p-6">
                  <div className="text-4xl mb-4">⏱️</div>
                  <h3 className="font-heading text-xl uppercase mb-2">SLOW ANALYSIS</h3>
                  <p className="text-sm opacity-80">
                    Manual wallet analysis requires checking multiple explorers, 
                    cross-referencing transactions, and computing metrics by hand.
                  </p>
                </div>
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="neo-card h-full">
                <div className="h-2 bg-[var(--chart-5)]" />
                <div className="p-6">
                  <div className="text-4xl mb-4">⚠️</div>
                  <h3 className="font-heading text-xl uppercase mb-2">HIDDEN RISKS</h3>
                  <p className="text-sm opacity-80">
                    Concentration risks, suspicious counterparties, and risky 
                    token approvals often go unnoticed until it&apos;s too late.
                  </p>
                </div>
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="neo-card h-full">
                <div className="h-2 bg-[var(--chart-2)]" />
                <div className="p-6">
                  <div className="text-4xl mb-4">💸</div>
                  <h3 className="font-heading text-xl uppercase mb-2">NO MONETIZATION</h3>
                  <p className="text-sm opacity-80">
                    Building blockchain tools is expensive. Without easy payment 
                    rails, developers struggle to monetize their agents.
                  </p>
                </div>
              </div>
            </StaggerItem>
          </StaggerContainer>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="min-h-screen flex items-center py-20 px-4 md:px-8">
        <div className="max-w-6xl mx-auto w-full">
          <AnimatedSection variant="glitch" className="mb-12 text-center">
            <span className="neo-pill text-xs mb-4 inline-block">03</span>
            <h2 className="font-heading text-4xl md:text-6xl uppercase tracking-tight">
              HOW IT <span className="text-[var(--main)]">WORKS</span>
            </h2>
          </AnimatedSection>

          <SimpleFlow />
        </div>
      </section>

      {/* Architecture Section */}
      <section className="min-h-screen flex items-center py-20 px-4 md:px-8 bg-secondary-background">
        <div className="max-w-7xl mx-auto w-full">
          <AnimatedSection variant="slam" className="mb-12 text-center">
            <span className="neo-pill text-xs mb-4 inline-block">04</span>
            <h2 className="font-heading text-4xl md:text-6xl uppercase tracking-tight">
              SYSTEM <span className="text-[var(--main)]">ARCHITECTURE</span>
            </h2>
            <p className="text-lg opacity-60 mt-4 max-w-2xl mx-auto">
              A modular architecture connecting clients, AI agents, and blockchain infrastructure
            </p>
          </AnimatedSection>

          <ArchitectureDiagram />
        </div>
      </section>

      {/* Technologies Section */}
      <section className="min-h-screen flex items-center py-20 px-4 md:px-8">
        <div className="max-w-6xl mx-auto w-full">
          <AnimatedSection variant="glitch" className="mb-12 text-center">
            <span className="neo-pill text-xs mb-4 inline-block">05</span>
            <h2 className="font-heading text-4xl md:text-6xl uppercase tracking-tight">
              KEY <span className="text-[var(--main)]">TECHNOLOGIES</span>
            </h2>
          </AnimatedSection>

          <StaggerContainer className="grid md:grid-cols-3 gap-6" staggerDelay={0.1}>
            <StaggerItem>
              <FeatureCard
                icon="🧠"
                title="SpoonOS"
                description="AI agent framework with tool-calling, LLM orchestration, and autonomous decision-making capabilities."
                color="teal"
                index={0}
              />
            </StaggerItem>
            <StaggerItem>
              <FeatureCard
                icon="⛓️"
                title="Neo N3"
                description="Smart economy blockchain with JSON-RPC access to balances, transfers, and contract interactions."
                color="blue"
                index={1}
              />
            </StaggerItem>
            <StaggerItem>
              <FeatureCard
                icon="💳"
                title="x402 Payments"
                description="Micropayment protocol on Base Sepolia enabling pay-per-invocation monetization (0.01 USDC/call)."
                color="yellow"
                index={2}
              />
            </StaggerItem>
          </StaggerContainer>
        </div>
      </section>

      {/* Python Backend Section */}
      <section className="min-h-screen flex items-center py-20 px-4 md:px-8 bg-secondary-background">
        <div className="max-w-6xl mx-auto w-full">
          <AnimatedSection variant="slam" className="mb-12 text-center">
            <span className="neo-pill text-xs mb-4 inline-block">06</span>
            <h2 className="font-heading text-4xl md:text-6xl uppercase tracking-tight">
              PYTHON <span className="text-[var(--main)]">BACKEND</span>
            </h2>
            <p className="text-lg opacity-60 mt-4 max-w-2xl mx-auto">
              Built with FastAPI and SpoonOS SDK for high-performance agent execution
            </p>
          </AnimatedSection>

          <div className="grid lg:grid-cols-2 gap-8">
            <AnimatedSection variant="slideLeft">
              <CodeShowcase
                code={agentCode}
                title="agent.py"
                language="python"
              />
            </AnimatedSection>

            <AnimatedSection variant="slideRight">
              <CodeShowcase
                code={toolCode}
                title="tools/wallet_summary.py"
                language="python"
              />
            </AnimatedSection>
          </div>

          {/* Terminal demo */}
          <AnimatedSection variant="slideUp" className="mt-12">
            <TerminalOutput
              lines={terminalLines}
              title="wallet-guardian demo"
            />
          </AnimatedSection>
        </div>
      </section>

      {/* Tools Section */}
      <section className="min-h-screen flex items-center py-20 px-4 md:px-8">
        <div className="max-w-6xl mx-auto w-full">
          <AnimatedSection variant="glitch" className="mb-12 text-center">
            <span className="neo-pill text-xs mb-4 inline-block">07</span>
            <h2 className="font-heading text-4xl md:text-6xl uppercase tracking-tight">
              AVAILABLE <span className="text-[var(--main)]">TOOLS</span>
            </h2>
          </AnimatedSection>

          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" staggerDelay={0.08}>
            {[
              { name: "get_wallet_summary", status: "live", desc: "Fetch balances, transfers, compute risk metrics" },
              { name: "wallet_validity_score", status: "live", desc: "0-100 validity score with deductions" },
              { name: "flag_counterparty_risk", status: "stub", desc: "Label counterparties with risk tags" },
              { name: "schedule_monitor", status: "stub", desc: "Set up alerts for wallet changes" },
              { name: "multi_wallet_diff", status: "stub", desc: "Compare diversification across wallets" },
              { name: "approval_scan", status: "stub", desc: "Check for risky token approvals" },
              { name: "action_draft", status: "stub", desc: "Generate safe action messages" },
            ].map((tool) => (
              <StaggerItem key={tool.name}>
                <div className="neo-card-interactive p-4 h-full">
                  <div className="flex items-start justify-between mb-2">
                    <code className="text-sm font-mono text-[var(--main)]">{tool.name}</code>
                    <span className={`text-xs uppercase px-2 py-1 border-2 border-border ${
                      tool.status === "live" 
                        ? "bg-[var(--severity-low)] text-black" 
                        : "bg-secondary-background"
                    }`}>
                      {tool.status}
                    </span>
                  </div>
                  <p className="text-xs opacity-70">{tool.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* x402 Payments Section */}
      <section className="min-h-screen flex items-center py-20 px-4 md:px-8 bg-secondary-background">
        <div className="max-w-6xl mx-auto w-full">
          <AnimatedSection variant="slam" className="mb-12 text-center">
            <span className="neo-pill text-xs mb-4 inline-block">08</span>
            <h2 className="font-heading text-4xl md:text-6xl uppercase tracking-tight">
              x402 <span className="text-[var(--main)]">PAYMENTS</span>
            </h2>
            <p className="text-lg opacity-60 mt-4 max-w-2xl mx-auto">
              Monetize your AI agents with micropayments on Base Sepolia
            </p>
          </AnimatedSection>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <AnimatedSection variant="slideLeft">
              <div className="neo-card p-8">
                <h3 className="font-heading text-2xl uppercase mb-6">HOW IT WORKS</h3>
                <div className="space-y-6">
                  {[
                    { step: "01", title: "Client Request", desc: "User sends API request to your agent" },
                    { step: "02", title: "Payment Check", desc: "x402 gateway verifies USDC payment" },
                    { step: "03", title: "Agent Execution", desc: "SpoonOS agent processes the request" },
                    { step: "04", title: "Result Returned", desc: "Insights delivered, payment settled" },
                  ].map((item, index) => (
                    <motion.div
                      key={item.step}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      viewport={{ once: true }}
                      className="flex items-start gap-4"
                    >
                      <div className="w-12 h-12 bg-[var(--main)] border-4 border-border flex items-center justify-center flex-shrink-0">
                        <span className="font-heading text-black">{item.step}</span>
                      </div>
                      <div>
                        <h4 className="font-heading uppercase">{item.title}</h4>
                        <p className="text-sm opacity-70">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection variant="slideRight">
              <div className="space-y-6">
                <div className="neo-card p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-[var(--chart-5)] border-4 border-border flex items-center justify-center">
                      <span className="text-3xl">💰</span>
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

                <div className="neo-card p-6 bg-[var(--main)]">
                  <h4 className="font-heading uppercase text-black mb-2">WHY x402?</h4>
                  <ul className="space-y-2 text-sm text-black">
                    <li className="flex items-center gap-2">
                      <span>+</span> No subscription overhead
                    </li>
                    <li className="flex items-center gap-2">
                      <span>+</span> Pay only for what you use
                    </li>
                    <li className="flex items-center gap-2">
                      <span>+</span> Instant settlement on L2
                    </li>
                    <li className="flex items-center gap-2">
                      <span>+</span> Developer-friendly integration
                    </li>
                  </ul>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="min-h-[70vh] flex items-center justify-center py-20 px-4 relative overflow-hidden">
        {/* Background pattern */}
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
              BUILD WITH<br />
              <span className="text-[var(--main)]">ASSERTION OS</span>
            </h2>
          </AnimatedSection>

          <AnimatedSection variant="slideUp" delay={200}>
            <p className="text-xl opacity-80 max-w-xl mx-auto mb-12">
              Start building autonomous blockchain agents today.
              Wallet Guardian is just the beginning.
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
                TRY WALLET GUARDIAN
                <span>→</span>
              </motion.a>
              <motion.a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.02, x: 4, y: 4 }}
                whileTap={{ scale: 0.98 }}
                className="neo-button inline-flex items-center gap-2"
              >
                VIEW SOURCE
                <span>↗</span>
              </motion.a>
            </div>
          </AnimatedSection>

          {/* Bottom decoration */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            viewport={{ once: true }}
            className="mt-20 flex justify-center gap-8 opacity-40"
          >
            {["SPOONOS", "NEO N3", "x402"].map((tech) => (
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

      {/* Footer */}
      <footer className="py-8 px-4 border-t-4 border-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="font-heading text-sm uppercase tracking-wider">
            ASSERTION OS — ENCODE HACKATHON 2024
          </div>
          <div className="text-sm opacity-60">
            Built with SpoonOS, Neo N3, x402
          </div>
        </div>
      </footer>
    </div>
  )
}
