'use client'

import { motion, type Variants, type HTMLMotionProps } from 'framer-motion'
import type { ReactNode } from 'react'

interface FadeInProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode
  /** Delay before starting (seconds). */
  delay?: number
  /** Distance to travel up (px). 0 = pure fade. */
  y?: number
  /** Duration (seconds). */
  duration?: number
}

export function FadeIn({ children, delay = 0, y = 16, duration = 0.45, ...rest }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

interface StaggerProps {
  children: ReactNode
  className?: string
  /** Delay between each child (seconds). */
  stagger?: number
  /** Initial delay before the first child (seconds). */
  delay?: number
}

const staggerContainerVariants: Variants = {
  hidden: { opacity: 1 },
  show: (custom: { stagger: number; delay: number }) => ({
    opacity: 1,
    transition: { staggerChildren: custom.stagger, delayChildren: custom.delay },
  }),
}

const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
}

/**
 * Wrap a list of items so they cascade in. Each direct child should be wrapped
 * in <Stagger.Item> for the effect.
 */
export function Stagger({ children, className, stagger = 0.08, delay = 0 }: StaggerProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={staggerContainerVariants}
      custom={{ stagger, delay }}
    >
      {children}
    </motion.div>
  )
}

Stagger.Item = function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={staggerItemVariants}>
      {children}
    </motion.div>
  )
}
