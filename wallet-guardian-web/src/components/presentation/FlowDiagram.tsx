"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { cn } from "~/lib/utils"

interface FlowBoxProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  color?: "default" | "main" | "accent"
  delay?: number
}

const colorVariants = {
  default: "bg-secondary-background border-border",
  main: "bg-[var(--main)] border-border text-black",
  accent: "bg-[var(--chart-5)] border-border text-black",
}

function FlowBox({ title, subtitle, icon, color = "default", delay = 0 }: FlowBoxProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })

  return (
    <motion.div
      ref={ref}
      initial={{ 
        scale: 0, 
        rotate: -20,
        opacity: 0,
      }}
      animate={isInView ? { 
        scale: 1, 
        rotate: 0,
        opacity: 1,
      } : {}}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 20,
        delay,
      }}
      className={cn(
        "border-4 p-4 min-w-[140px] text-center relative",
        colorVariants[color]
      )}
      style={{ boxShadow: "var(--shadow)" }}
    >
      {icon && (
        <div className="text-2xl mb-1">{icon}</div>
      )}
      <div className="font-heading text-sm uppercase tracking-wider">
        {title}
      </div>
      {subtitle && (
        <div className="text-xs opacity-70 mt-1">
          {subtitle}
        </div>
      )}
    </motion.div>
  )
}

interface ConnectorProps {
  direction?: "horizontal" | "vertical" | "down-right" | "down-left"
  delay?: number
  length?: number
}

function Connector({ direction = "horizontal", delay = 0, length = 60 }: ConnectorProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-30px" })

  const isHorizontal = direction === "horizontal"

  return (
    <div 
      ref={ref}
      className={cn(
        "flex items-center justify-center relative",
        isHorizontal ? "mx-2" : "my-2"
      )}
      style={{
        width: isHorizontal ? length : 4,
        height: isHorizontal ? 4 : length,
      }}
    >
      {/* Line */}
      <motion.div
        initial={{ 
          scaleX: isHorizontal ? 0 : 1,
          scaleY: isHorizontal ? 1 : 0,
        }}
        animate={isInView ? { 
          scaleX: 1,
          scaleY: 1,
        } : {}}
        transition={{
          duration: 0.3,
          delay,
          ease: [0.25, 0.46, 0.45, 0.94],
        }}
        style={{ 
          originX: 0,
          originY: 0,
        }}
        className="absolute inset-0 bg-border"
      />
      
      {/* Arrow head */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={isInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ delay: delay + 0.2, duration: 0.15 }}
        className={cn(
          "absolute w-0 h-0",
          isHorizontal 
            ? "right-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-border" 
            : "bottom-0 border-x-[6px] border-x-transparent border-t-[10px] border-t-border"
        )}
      />
    </div>
  )
}

// Main architecture diagram
export function ArchitectureDiagram() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <div ref={ref} className="w-full overflow-x-auto py-8">
      <div className="min-w-[800px] mx-auto">
        {/* Top row - Client to Agent */}
        <div className="flex items-center justify-center mb-8">
          <FlowBox 
            title="CLIENT" 
            subtitle="Web / CLI" 
            icon="👤"
            delay={0}
          />
          <Connector delay={0.2} length={80} />
          <FlowBox 
            title="x402 GATEWAY" 
            subtitle="Payment Verify" 
            icon="💳"
            color="accent"
            delay={0.3}
          />
          <Connector delay={0.5} length={80} />
          <FlowBox 
            title="ASSERTION OS" 
            subtitle="AI Agent" 
            icon="🤖"
            color="main"
            delay={0.6}
          />
        </div>

        {/* Vertical connector from Agent */}
        <div className="flex justify-center">
          <div className="flex flex-col items-center" style={{ marginLeft: 400 }}>
            <Connector direction="vertical" delay={0.8} length={40} />
          </div>
        </div>

        {/* Tool layer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 1 }}
          className="flex justify-center gap-4 mb-8"
        >
          <FlowBox 
            title="WALLET SUMMARY" 
            icon="📊"
            delay={1.1}
          />
          <FlowBox 
            title="RISK SCORE" 
            icon="⚠️"
            delay={1.2}
          />
          <FlowBox 
            title="COUNTERPARTY" 
            icon="🔍"
            delay={1.3}
          />
          <FlowBox 
            title="ALERTS" 
            icon="🔔"
            delay={1.4}
          />
        </motion.div>

        {/* Label for tools */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.5 }}
          className="text-center mb-8"
        >
          <span className="neo-pill text-xs">TOOL LAYER</span>
        </motion.div>

        {/* Bottom connectors to external services */}
        <div className="flex justify-center gap-20">
          <div className="flex flex-col items-center">
            <Connector direction="vertical" delay={1.6} length={40} />
            <FlowBox 
              title="NEO N3" 
              subtitle="Blockchain RPC" 
              icon="⛓️"
              color="main"
              delay={1.8}
            />
          </div>
          <div className="flex flex-col items-center">
            <Connector direction="vertical" delay={1.75} length={40} />
            <FlowBox 
              title="BASE SEPOLIA" 
              subtitle="x402 Payments" 
              icon="💰"
              color="accent"
              delay={2.0}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// Simplified horizontal flow for mobile/compact view
export function SimpleFlow() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })

  const steps = [
    { num: "01", title: "QUERY", desc: "User submits wallet address", icon: "📝" },
    { num: "02", title: "AGENT", desc: "AI decides which tools to call", icon: "🤖" },
    { num: "03", title: "EXECUTE", desc: "Tools fetch blockchain data", icon: "⚡" },
    { num: "04", title: "RESULT", desc: "Risk insights returned", icon: "✅" },
  ]

  return (
    <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {steps.map((step, index) => (
        <motion.div
          key={step.num}
          initial={{ 
            opacity: 0, 
            y: 50,
            rotate: index % 2 === 0 ? -5 : 5,
          }}
          animate={isInView ? { 
            opacity: 1, 
            y: 0,
            rotate: 0,
          } : {}}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 25,
            delay: index * 0.15,
          }}
          className="relative"
        >
          {/* Step number badge */}
          <motion.div
            initial={{ scale: 0 }}
            animate={isInView ? { scale: 1 } : {}}
            transition={{ delay: index * 0.15 + 0.1, type: "spring", stiffness: 500 }}
            className="absolute -top-4 -left-2 w-12 h-12 bg-[var(--main)] border-4 border-border flex items-center justify-center z-10"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <span className="font-heading text-lg text-black">{step.num}</span>
          </motion.div>

          {/* Card content */}
          <div className="neo-card pt-10 pb-6 px-4">
            <div className="text-3xl mb-2">{step.icon}</div>
            <h4 className="font-heading text-lg uppercase tracking-wider mb-2">
              {step.title}
            </h4>
            <p className="text-sm opacity-70">
              {step.desc}
            </p>
          </div>

          {/* Connector arrow (not on last item) */}
          {index < steps.length - 1 && (
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={isInView ? { opacity: 1, scaleX: 1 } : {}}
              transition={{ delay: index * 0.15 + 0.3 }}
              className="hidden lg:block absolute top-1/2 -right-3 w-6"
            >
              <div className="w-full h-1 bg-border" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-y-[5px] border-y-transparent border-l-[8px] border-l-border" />
            </motion.div>
          )}
        </motion.div>
      ))}
    </div>
  )
}

// Decision tree diagram for offload logic
export function OffloadDecisionDiagram() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })

  return (
    <div ref={ref} className="max-w-2xl mx-auto">
      {/* Decision node */}
      <motion.div
        initial={{ scale: 0, rotate: 45 }}
        animate={isInView ? { scale: 1, rotate: 0 } : {}}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="w-48 h-48 mx-auto bg-[var(--chart-5)] border-4 border-border flex items-center justify-center text-center p-4 rotate-0"
        style={{ 
          clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
          boxShadow: "var(--shadow)",
        }}
      >
        <div>
          <div className="font-heading text-sm text-black uppercase">Dataset</div>
          <div className="font-heading text-2xl text-black">&gt;100MB?</div>
        </div>
      </motion.div>

      {/* Branches */}
      <div className="flex justify-center gap-32 mt-8">
        {/* YES branch */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <div className="text-[var(--severity-low)] font-heading text-xl mb-4">YES</div>
          <div className="neo-card p-4 bg-[var(--main)]">
            <div className="text-2xl mb-2">☁️</div>
            <div className="font-heading text-sm text-black uppercase">OFFLOAD</div>
            <div className="text-xs text-black opacity-70">to AIOZ</div>
          </div>
        </motion.div>

        {/* NO branch */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <div className="text-[var(--severity-critical)] font-heading text-xl mb-4">NO</div>
          <div className="neo-card p-4">
            <div className="text-2xl mb-2">💻</div>
            <div className="font-heading text-sm uppercase">LOCAL</div>
            <div className="text-xs opacity-70">Run here</div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// Neo Oracle Flow Diagram
export function OracleFlowDiagram() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })

  const steps = [
    { 
      num: "1", 
      title: "REQUEST", 
      desc: "dApp calls request_risk_score(address)",
      icon: "📤",
      color: "main" as const,
    },
    { 
      num: "2", 
      title: "ORACLE", 
      desc: "Neo Oracle fetches from Wallet Guardian API",
      icon: "🔮",
      color: "accent" as const,
    },
    { 
      num: "3", 
      title: "CALLBACK", 
      desc: "oracle_callback stores score on-chain",
      icon: "💾",
      color: "main" as const,
    },
    { 
      num: "4", 
      title: "QUERY", 
      desc: "Any contract calls is_risky(address, 60)",
      icon: "✅",
      color: "default" as const,
    },
  ]

  return (
    <div ref={ref} className="w-full py-8">
      {/* Flow boxes */}
      <div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-2">
        {steps.map((step, index) => (
          <div key={step.num} className="flex items-center">
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.8 }}
              animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25,
                delay: index * 0.2,
              }}
              className={cn(
                "border-4 p-4 min-w-[160px] text-center relative",
                step.color === "main" 
                  ? "bg-[var(--main)] border-border text-black"
                  : step.color === "accent"
                  ? "bg-[var(--chart-5)] border-border text-black"
                  : "bg-secondary-background border-border"
              )}
              style={{ boxShadow: "var(--shadow)" }}
            >
              {/* Step number badge */}
              <div className="absolute -top-3 -left-3 w-8 h-8 bg-black border-2 border-border flex items-center justify-center">
                <span className="font-heading text-sm text-white">{step.num}</span>
              </div>
              <div className="text-2xl mb-1">{step.icon}</div>
              <div className="font-heading text-sm uppercase tracking-wider">
                {step.title}
              </div>
              <div className="text-xs opacity-70 mt-1">
                {step.desc}
              </div>
            </motion.div>

            {/* Arrow connector (not on last item) */}
            {index < steps.length - 1 && (
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={isInView ? { opacity: 1, scaleX: 1 } : {}}
                transition={{ delay: index * 0.2 + 0.15 }}
                className="hidden lg:flex items-center mx-2"
              >
                <div className="w-8 h-1 bg-border" />
                <div className="w-0 h-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-border" />
              </motion.div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom note */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 1 }}
        className="text-center mt-8"
      >
        <span className="neo-pill text-xs">TRUSTLESS ON-CHAIN RISK VERIFICATION</span>
      </motion.div>
    </div>
  )
}

// Updated Architecture Diagram with multi-chain support
export function MultiChainArchitectureDiagram() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <div ref={ref} className="w-full overflow-x-auto py-8">
      <div className="min-w-[900px] mx-auto">
        {/* Top row - Client to Agent */}
        <div className="flex items-center justify-center mb-8">
          <FlowBox 
            title="CLIENT" 
            subtitle="Web / CLI / dApp" 
            icon="👤"
            delay={0}
          />
          <Connector delay={0.2} length={60} />
          <FlowBox 
            title="x402 GATEWAY" 
            subtitle="Pay per invoke" 
            icon="💳"
            color="accent"
            delay={0.3}
          />
          <Connector delay={0.5} length={60} />
          <FlowBox 
            title="SPOONOS AGENT" 
            subtitle="ToolCallAgent" 
            icon="🤖"
            color="main"
            delay={0.6}
          />
        </div>

        {/* Vertical connector from Agent */}
        <div className="flex justify-center">
          <div className="flex flex-col items-center" style={{ marginLeft: 350 }}>
            <Connector direction="vertical" delay={0.8} length={40} />
          </div>
        </div>

        {/* Graph Orchestrator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.9 }}
          className="flex justify-center mb-4"
        >
          <div className="neo-card p-3 border-4 border-[var(--main)]">
            <span className="font-heading text-sm uppercase">GRAPH ORCHESTRATOR</span>
            <span className="text-xs opacity-60 ml-2">DAG Computation</span>
          </div>
        </motion.div>

        {/* Vertical connector */}
        <div className="flex justify-center">
          <Connector direction="vertical" delay={1.0} length={30} />
        </div>

        {/* Tool layer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 1.1 }}
          className="flex justify-center gap-3 mb-8 flex-wrap"
        >
          {[
            { title: "WALLET", icon: "📊" },
            { title: "RISK", icon: "⚠️" },
            { title: "SCANNER", icon: "🔍" },
            { title: "MONITOR", icon: "🔔" },
            { title: "PORTFOLIO", icon: "💼" },
          ].map((tool, i) => (
            <FlowBox 
              key={tool.title}
              title={tool.title} 
              icon={tool.icon}
              delay={1.2 + i * 0.08}
            />
          ))}
        </motion.div>

        {/* Label for tools */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.6 }}
          className="text-center mb-8"
        >
          <span className="neo-pill text-xs">8 SPOONOS TOOLS</span>
        </motion.div>

        {/* Bottom connectors to external services */}
        <div className="flex justify-center gap-12">
          <div className="flex flex-col items-center">
            <Connector direction="vertical" delay={1.7} length={40} />
            <FlowBox 
              title="NEO N3" 
              subtitle="+ Oracle Contract" 
              icon="⛓️"
              color="main"
              delay={1.9}
            />
          </div>
          <div className="flex flex-col items-center">
            <Connector direction="vertical" delay={1.8} length={40} />
            <FlowBox 
              title="ETHEREUM" 
              subtitle="Blockscout API" 
              icon="🔷"
              color="accent"
              delay={2.0}
            />
          </div>
          <div className="flex flex-col items-center">
            <Connector direction="vertical" delay={1.85} length={40} />
            <FlowBox 
              title="BASE SEPOLIA" 
              subtitle="x402 Payments" 
              icon="💰"
              delay={2.1}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
