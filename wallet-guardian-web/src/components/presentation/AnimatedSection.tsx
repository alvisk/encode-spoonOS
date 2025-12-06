"use client"

import { motion, useInView, type Variant } from "framer-motion"
import { useRef } from "react"
import { cn } from "~/lib/utils"

type AnimationVariant = "slam" | "glitch" | "slideLeft" | "slideRight" | "slideUp" | "stagger" | "typewriter" | "flip"

interface AnimatedSectionProps {
  children: React.ReactNode
  variant?: AnimationVariant
  delay?: number
  className?: string
  once?: boolean
}

const variants: Record<AnimationVariant, { hidden: Variant; visible: Variant }> = {
  slam: {
    hidden: { 
      scale: 0, 
      rotate: -12,
      opacity: 0,
    },
    visible: { 
      scale: 1, 
      rotate: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 500,
        damping: 25,
        mass: 1,
      }
    }
  },
  glitch: {
    hidden: { 
      opacity: 0,
      x: -100,
      skewX: 20,
    },
    visible: { 
      opacity: 1,
      x: 0,
      skewX: 0,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94],
      }
    }
  },
  slideLeft: {
    hidden: { 
      opacity: 0, 
      x: -150,
    },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
      }
    }
  },
  slideRight: {
    hidden: { 
      opacity: 0, 
      x: 150,
    },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
      }
    }
  },
  slideUp: {
    hidden: { 
      opacity: 0, 
      y: 100,
    },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
      }
    }
  },
  stagger: {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      }
    }
  },
  typewriter: {
    hidden: { 
      opacity: 0,
      width: 0,
    },
    visible: { 
      opacity: 1,
      width: "100%",
      transition: {
        duration: 0.8,
        ease: "easeOut",
      }
    }
  },
  flip: {
    hidden: { 
      opacity: 0,
      rotateX: -90,
      transformPerspective: 1000,
    },
    visible: { 
      opacity: 1,
      rotateX: 0,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 30,
      }
    }
  },
}

export function AnimatedSection({ 
  children, 
  variant = "slideUp", 
  delay = 0, 
  className,
  once = true,
}: AnimatedSectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, margin: "-100px" })

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={variants[variant]}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  )
}

// Stagger container for child animations
interface StaggerContainerProps {
  children: React.ReactNode
  className?: string
  staggerDelay?: number
}

export function StaggerContainer({ children, className, staggerDelay = 0.1 }: StaggerContainerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: 0.1,
          }
        }
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  )
}

// Stagger item - use inside StaggerContainer
interface StaggerItemProps {
  children: React.ReactNode
  className?: string
}

export function StaggerItem({ children, className }: StaggerItemProps) {
  return (
    <motion.div
      variants={{
        hidden: { 
          opacity: 0, 
          y: 50,
          scale: 0.9,
          rotate: -5,
        },
        visible: { 
          opacity: 1, 
          y: 0,
          scale: 1,
          rotate: 0,
          transition: {
            type: "spring",
            stiffness: 400,
            damping: 25,
          }
        }
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  )
}

// Glitch text effect
interface GlitchTextProps {
  children: string
  className?: string
}

export function GlitchText({ children, className }: GlitchTextProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true })

  return (
    <motion.div
      ref={ref}
      className={cn("relative inline-block", className)}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
    >
      <motion.span
        className="relative z-10"
        animate={isInView ? {
          x: [0, -3, 3, -2, 2, 0],
          transition: {
            duration: 0.5,
            times: [0, 0.2, 0.4, 0.6, 0.8, 1],
            delay: 0.2,
          }
        } : {}}
      >
        {children}
      </motion.span>
      {/* Glitch layers */}
      <motion.span
        className="absolute inset-0 text-[var(--chart-4)] z-0"
        style={{ clipPath: "inset(10% 0 60% 0)" }}
        animate={isInView ? {
          x: [0, 4, -4, 0],
          opacity: [0, 1, 1, 0],
          transition: {
            duration: 0.4,
            times: [0, 0.33, 0.66, 1],
            delay: 0.3,
            repeat: 2,
          }
        } : {}}
      >
        {children}
      </motion.span>
      <motion.span
        className="absolute inset-0 text-[var(--main)] z-0"
        style={{ clipPath: "inset(60% 0 10% 0)" }}
        animate={isInView ? {
          x: [0, -4, 4, 0],
          opacity: [0, 1, 1, 0],
          transition: {
            duration: 0.4,
            times: [0, 0.33, 0.66, 1],
            delay: 0.35,
            repeat: 2,
          }
        } : {}}
      >
        {children}
      </motion.span>
    </motion.div>
  )
}

// Counter animation for numbers
interface AnimatedCounterProps {
  value: number
  duration?: number
  className?: string
}

export function AnimatedCounter({ value, duration = 2, className }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })

  return (
    <motion.span
      ref={ref}
      className={cn("tabular-nums", className)}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
    >
      <motion.span
        initial={{ opacity: 0 }}
        animate={isInView ? {
          opacity: 1,
        } : { opacity: 0 }}
      >
        {isInView && (
          <CountUp value={value} duration={duration} />
        )}
      </motion.span>
    </motion.span>
  )
}

function CountUp({ value, duration }: { value: number; duration: number }) {
  return (
    <motion.span
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
    >
      <motion.span
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        transition={{ duration }}
      >
        {value}
      </motion.span>
    </motion.span>
  )
}
