"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { cn } from "~/lib/utils"

interface FeatureCardProps {
  icon: React.ReactNode
  title: string
  description: string
  color?: "teal" | "red" | "yellow" | "blue" | "purple"
  index?: number
  className?: string
}

const colorVariants = {
  teal: "border-[var(--main)] bg-[var(--main)]",
  red: "border-[var(--chart-4)] bg-[var(--chart-4)]",
  yellow: "border-[var(--chart-5)] bg-[var(--chart-5)]",
  blue: "border-[var(--chart-2)] bg-[var(--chart-2)]",
  purple: "border-[var(--chart-3)] bg-[var(--chart-3)]",
}

const iconColorVariants = {
  teal: "text-black",
  red: "text-white",
  yellow: "text-black",
  blue: "text-white",
  purple: "text-white",
}

export function FeatureCard({ 
  icon, 
  title, 
  description, 
  color = "teal",
  index = 0,
  className,
}: FeatureCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })

  const rotation = index % 2 === 0 ? -3 : 3

  return (
    <motion.div
      ref={ref}
      initial={{ 
        opacity: 0, 
        y: 100,
        rotate: rotation * 2,
        scale: 0.8,
      }}
      animate={isInView ? { 
        opacity: 1, 
        y: 0,
        rotate: 0,
        scale: 1,
      } : {}}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
        delay: index * 0.1,
      }}
      whileHover={{
        y: -8,
        rotate: rotation,
        transition: { duration: 0.1 }
      }}
      className={cn(
        "neo-card-interactive cursor-pointer overflow-hidden",
        className
      )}
    >
      {/* Top accent bar */}
      <div className={cn("h-3", colorVariants[color])} />
      
      <div className="p-6">
        {/* Icon container */}
        <motion.div
          className={cn(
            "w-16 h-16 flex items-center justify-center border-4 border-border mb-4",
            colorVariants[color],
            iconColorVariants[color]
          )}
          whileHover={{ 
            scale: 1.1, 
            rotate: 10,
            transition: { duration: 0.1 }
          }}
        >
          <span className="text-3xl">{icon}</span>
        </motion.div>

        {/* Title */}
        <h3 className="font-heading text-xl uppercase tracking-wider mb-2">
          {title}
        </h3>

        {/* Description */}
        <p className="text-sm opacity-80 leading-relaxed">
          {description}
        </p>
      </div>

      {/* Bottom decoration */}
      <div className="h-2 danger-stripes-thin opacity-50" />
    </motion.div>
  )
}

// Stats card variant
interface StatsCardProps {
  value: string | number
  label: string
  icon?: React.ReactNode
  index?: number
}

export function StatsCard({ value, label, icon, index = 0 }: StatsCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })

  return (
    <motion.div
      ref={ref}
      initial={{ 
        opacity: 0, 
        scale: 0,
        rotate: -15,
      }}
      animate={isInView ? { 
        opacity: 1, 
        scale: 1,
        rotate: 0,
      } : {}}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 25,
        delay: index * 0.15,
      }}
      className="neo-card p-6 text-center"
    >
      {icon && (
        <div className="text-4xl mb-2">{icon}</div>
      )}
      <motion.div
        initial={{ scale: 0.5 }}
        animate={isInView ? { scale: 1 } : { scale: 0.5 }}
        transition={{ delay: index * 0.15 + 0.2, type: "spring", stiffness: 300 }}
        className="font-heading text-5xl text-[var(--main)] mb-2"
      >
        {value}
      </motion.div>
      <div className="text-sm uppercase tracking-widest opacity-70">
        {label}
      </div>
    </motion.div>
  )
}

// Step card for flow diagram
interface StepCardProps {
  number: number
  title: string
  description: string
  isLast?: boolean
  index?: number
}

export function StepCard({ number, title, description, isLast = false, index = 0 }: StepCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })

  return (
    <div ref={ref} className="flex items-start gap-4">
      {/* Step number */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={isInView ? { scale: 1, rotate: 0 } : {}}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 20,
          delay: index * 0.2,
        }}
        className="flex-shrink-0 w-16 h-16 bg-[var(--main)] border-4 border-border flex items-center justify-center"
      >
        <span className="font-heading text-3xl text-black">{number}</span>
      </motion.div>

      {/* Connector line */}
      {!isLast && (
        <motion.div
          initial={{ scaleY: 0 }}
          animate={isInView ? { scaleY: 1 } : {}}
          transition={{ delay: index * 0.2 + 0.3, duration: 0.3 }}
          style={{ originY: 0 }}
          className="absolute left-8 top-16 w-1 h-full bg-border -z-10"
        />
      )}

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={isInView ? { opacity: 1, x: 0 } : {}}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 25,
          delay: index * 0.2 + 0.1,
        }}
        className="flex-1 neo-card p-4"
      >
        <h4 className="font-heading text-lg uppercase tracking-wider mb-1">
          {title}
        </h4>
        <p className="text-sm opacity-80">
          {description}
        </p>
      </motion.div>
    </div>
  )
}
