'use client'

import { motion } from 'framer-motion'
import { Rocket } from 'lucide-react'

interface RocketLoaderProps {
  open: boolean
  label?: string
  subLabel?: string
  /** When true, renders a settled checkmark instead of an in-flight rocket. */
  done?: boolean
}

/**
 * Full-screen rocket-launch loader. Used for one-shot create flows
 * (school registration, setup completion) where we want the wait
 * to feel like an event, not a stutter.
 */
export default function RocketLoader({ open, label = 'Launching…', subLabel, done = false }: RocketLoaderProps) {
  if (!open) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-[#001f44]/97 via-[#003a82]/97 to-[#0058be]/95 backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      {/* Starfield */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => {
          const size = (i % 5) * 0.6 + 1
          return (
            <motion.span
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: size,
                height: size,
                left: `${(i * 137) % 100}%`,
                top: `${(i * 71) % 100}%`,
              }}
              initial={{ opacity: 0.2 }}
              animate={{ opacity: [0.2, 0.9, 0.2] }}
              transition={{ duration: 1.6 + (i % 5) * 0.3, repeat: Infinity, delay: (i % 7) * 0.2 }}
            />
          )
        })}
      </div>

      <div className="relative flex flex-col items-center text-center px-6">
        {/* Rocket / done badge */}
        <div className="relative w-24 h-32 mb-8 flex items-end justify-center">
          {!done && (
            <>
              {/* Exhaust trail — branded blues */}
              <motion.div
                className="absolute bottom-0 w-2 rounded-full bg-gradient-to-b from-cyan-300 via-sky-200 to-transparent"
                initial={{ height: 8, opacity: 0.4 }}
                animate={{ height: [12, 60, 12], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                style={{ filter: 'blur(2px)' }}
              />
              <motion.div
                className="absolute bottom-0 w-1 rounded-full bg-white"
                initial={{ height: 4, opacity: 0.6 }}
                animate={{ height: [6, 30, 6], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 0.6, repeat: Infinity }}
              />
            </>
          )}
          <motion.div
            initial={{ y: 0, rotate: -8 }}
            animate={done ? { y: -6, rotate: 0, scale: 1.1 } : { y: [-6, 4, -6], rotate: [-8, -4, -8] }}
            transition={done ? { duration: 0.4 } : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br from-white to-sky-100 flex items-center justify-center shadow-2xl shadow-sky-500/40 ring-1 ring-white/30"
          >
            <Rocket className="w-8 h-8 text-[#0058be]" strokeWidth={2.5} />
          </motion.div>
        </div>

        <motion.p
          key={label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl font-bold text-white tracking-tight mb-2 drop-shadow-sm"
          style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}
        >
          {label}
        </motion.p>
        {subLabel && (
          <motion.p
            key={subLabel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-sm text-sky-100/85 max-w-xs"
          >
            {subLabel}
          </motion.p>
        )}

        {/* Indeterminate progress bar */}
        {!done && (
          <div className="mt-8 w-64 h-1 bg-white/15 rounded-full overflow-hidden">
            <motion.div
              className="h-full w-1/3 rounded-full bg-gradient-to-r from-white via-sky-200 to-white"
              animate={{ x: ['-100%', '300%'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        )}
      </div>
    </motion.div>
  )
}
