"use client"

import { motion, useInView } from "framer-motion"
import { useRef, useEffect, useState } from "react"
import { cn } from "~/lib/utils"

interface CodeShowcaseProps {
  code: string
  language?: string
  title?: string
  className?: string
}

// Simple syntax highlighting for Python
function highlightPython(code: string): React.ReactNode[] {
  const lines = code.split("\n")
  
  return lines.map((line, lineIndex) => {
    // Keywords
    const keywords = ["class", "def", "from", "import", "return", "if", "else", "elif", "for", "while", "in", "not", "and", "or", "True", "False", "None", "async", "await", "self"]
    const decorators = line.match(/@\w+/g)
    const strings = line.match(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g)
    const comments = line.match(/#.*/g)
    
    let highlightedLine = line

    // Highlight comments (do this first to avoid conflicts)
    if (comments) {
      comments.forEach(comment => {
        highlightedLine = highlightedLine.replace(
          comment,
          `<span class="text-[var(--chart-2)] opacity-60">${comment}</span>`
        )
      })
    }

    // Highlight strings
    if (strings && !comments) {
      strings.forEach(str => {
        highlightedLine = highlightedLine.replace(
          str,
          `<span class="text-[var(--chart-5)]">${str}</span>`
        )
      })
    }

    // Highlight keywords
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, "g")
      highlightedLine = highlightedLine.replace(
        regex,
        `<span class="text-[var(--main)] font-bold">${keyword}</span>`
      )
    })

    // Highlight decorators
    if (decorators) {
      decorators.forEach(decorator => {
        highlightedLine = highlightedLine.replace(
          decorator,
          `<span class="text-[var(--chart-3)]">${decorator}</span>`
        )
      })
    }

    // Highlight class/function names (word after class/def)
    highlightedLine = highlightedLine.replace(
      /(<span class="text-\[var\(--main\)\] font-bold">(?:class|def)<\/span>\s+)(\w+)/g,
      `$1<span class="text-[var(--chart-4)]">$2</span>`
    )

    return (
      <span 
        key={lineIndex} 
        className="block"
        dangerouslySetInnerHTML={{ __html: highlightedLine || "&nbsp;" }}
      />
    )
  })
}

export function CodeShowcase({ code, language = "python", title, className }: CodeShowcaseProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  const [displayedLines, setDisplayedLines] = useState(0)
  const lines = code.split("\n")

  useEffect(() => {
    if (isInView) {
      let currentLine = 0
      const interval = setInterval(() => {
        currentLine++
        setDisplayedLines(currentLine)
        if (currentLine >= lines.length) {
          clearInterval(interval)
        }
      }, 80) // Speed of line reveal

      return () => clearInterval(interval)
    }
  }, [isInView, lines.length])

  const highlightedLines = highlightPython(code)

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50, rotate: -2 }}
      animate={isInView ? { opacity: 1, y: 0, rotate: 0 } : {}}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={cn("neo-card overflow-hidden", className)}
    >
      {/* Title bar */}
      {title && (
        <div className="danger-stripes-thin h-2" />
      )}
      <div className="bg-secondary-background border-b-4 border-border px-4 py-3 flex items-center gap-3">
        {/* Terminal dots */}
        <div className="flex gap-2">
          <div className="w-3 h-3 bg-[var(--chart-4)] border-2 border-border" />
          <div className="w-3 h-3 bg-[var(--chart-5)] border-2 border-border" />
          <div className="w-3 h-3 bg-[var(--severity-low)] border-2 border-border" />
        </div>
        {title && (
          <span className="font-mono text-sm uppercase tracking-wider">
            {title}
          </span>
        )}
        <span className="ml-auto text-xs opacity-50 uppercase">{language}</span>
      </div>

      {/* Code content */}
      <div className="p-4 font-mono text-sm overflow-x-auto bg-background">
        <pre className="leading-relaxed">
          {highlightedLines.map((line, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ 
                opacity: index < displayedLines ? 1 : 0,
                x: index < displayedLines ? 0 : -20,
              }}
              transition={{ duration: 0.1 }}
              className="flex"
            >
              {/* Line number */}
              <span className="w-8 text-right pr-4 opacity-30 select-none">
                {index + 1}
              </span>
              {/* Line content */}
              <span className="flex-1">{line}</span>
            </motion.div>
          ))}
          {/* Cursor */}
          {displayedLines < lines.length && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="inline-block w-2 h-5 bg-[var(--main)] ml-8"
            />
          )}
        </pre>
      </div>
    </motion.div>
  )
}

// Terminal-style output showcase
interface TerminalOutputProps {
  lines: Array<{
    type: "command" | "output" | "success" | "error" | "info"
    content: string
  }>
  title?: string
}

export function TerminalOutput({ lines, title = "terminal" }: TerminalOutputProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })
  const [displayedLines, setDisplayedLines] = useState(0)

  useEffect(() => {
    if (isInView) {
      let currentLine = 0
      const interval = setInterval(() => {
        currentLine++
        setDisplayedLines(currentLine)
        if (currentLine >= lines.length) {
          clearInterval(interval)
        }
      }, 150)

      return () => clearInterval(interval)
    }
  }, [isInView, lines.length])

  const typeStyles = {
    command: "text-[var(--chart-5)]",
    output: "text-foreground opacity-80",
    success: "text-[var(--severity-low)]",
    error: "text-[var(--severity-critical)]",
    info: "text-[var(--main)]",
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="neo-card overflow-hidden"
    >
      {/* Title bar */}
      <div className="bg-black border-b-4 border-border px-4 py-3 flex items-center gap-3">
        <div className="flex gap-2">
          <div className="w-3 h-3 bg-[var(--chart-4)] border-2 border-black" />
          <div className="w-3 h-3 bg-[var(--chart-5)] border-2 border-black" />
          <div className="w-3 h-3 bg-[var(--severity-low)] border-2 border-black" />
        </div>
        <span className="font-mono text-sm text-white uppercase tracking-wider">
          {title}
        </span>
      </div>

      {/* Terminal content */}
      <div className="p-4 font-mono text-sm bg-black text-white min-h-[200px]">
        {lines.map((line, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ 
              opacity: index < displayedLines ? 1 : 0,
              x: index < displayedLines ? 0 : -10,
            }}
            transition={{ duration: 0.1 }}
            className={cn("py-1", typeStyles[line.type])}
          >
            {line.type === "command" && (
              <span className="text-[var(--main)] mr-2">$</span>
            )}
            {line.type === "success" && (
              <span className="mr-2">✓</span>
            )}
            {line.type === "error" && (
              <span className="mr-2">✗</span>
            )}
            {line.type === "info" && (
              <span className="mr-2">→</span>
            )}
            {line.content}
          </motion.div>
        ))}
        {/* Blinking cursor */}
        {displayedLines >= lines.length && (
          <motion.div
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="flex items-center gap-2 pt-2"
          >
            <span className="text-[var(--main)]">$</span>
            <span className="w-2 h-5 bg-white" />
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

// Comparison showcase (Local vs Cloud)
interface ComparisonProps {
  leftTitle: string
  rightTitle: string
  leftItems: string[]
  rightItems: string[]
}

export function ComparisonShowcase({ leftTitle, rightTitle, leftItems, rightItems }: ComparisonProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })

  return (
    <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left side */}
      <motion.div
        initial={{ opacity: 0, x: -50, rotate: -3 }}
        animate={isInView ? { opacity: 1, x: 0, rotate: 0 } : {}}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="neo-card overflow-hidden"
      >
        <div className="bg-[var(--chart-4)] p-3 border-b-4 border-border">
          <h4 className="font-heading text-lg uppercase text-white text-center">
            {leftTitle}
          </h4>
        </div>
        <div className="p-4 space-y-3">
          {leftItems.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: index * 0.1 + 0.3 }}
              className="flex items-center gap-3"
            >
              <span className="text-[var(--chart-4)]">✗</span>
              <span className="text-sm">{item}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* VS divider */}
      <motion.div
        initial={{ scale: 0 }}
        animate={isInView ? { scale: 1 } : {}}
        transition={{ delay: 0.2, type: "spring", stiffness: 500 }}
        className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
      >
        <div className="w-16 h-16 bg-[var(--chart-5)] border-4 border-border flex items-center justify-center rotate-12"
          style={{ boxShadow: "var(--shadow)" }}
        >
          <span className="font-heading text-xl text-black">VS</span>
        </div>
      </motion.div>

      {/* Right side */}
      <motion.div
        initial={{ opacity: 0, x: 50, rotate: 3 }}
        animate={isInView ? { opacity: 1, x: 0, rotate: 0 } : {}}
        transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
        className="neo-card overflow-hidden"
      >
        <div className="bg-[var(--severity-low)] p-3 border-b-4 border-border">
          <h4 className="font-heading text-lg uppercase text-black text-center">
            {rightTitle}
          </h4>
        </div>
        <div className="p-4 space-y-3">
          {rightItems.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: 20 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: index * 0.1 + 0.4 }}
              className="flex items-center gap-3"
            >
              <span className="text-[var(--severity-low)]">✓</span>
              <span className="text-sm">{item}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
