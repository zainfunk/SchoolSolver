'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronRight, ChevronLeft, HelpCircle } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface TourStep {
  targetId?: string           // data-tour-id attribute on the element to highlight
  title: string
  description: string
  tooltipSide?: 'right' | 'bottom' | 'top'
  // If true, the user must click the highlighted element to advance
  requiresClick?: boolean
  // If clicking the element navigates away, set this so we advance on navigation
  clickNavigates?: boolean
}

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

// ── Persistence key ────────────────────────────────────────────────────────

const STORAGE_KEY = 'clubit-tour-state'

function saveTourState(role: string, stepIdx: number) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ role, stepIdx })) } catch {}
}

function loadTourState(): { role: string; stepIdx: number } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function clearTourState() {
  try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
}

// ── Tour steps by role ─────────────────────────────────────────────────────

const STUDENT_STEPS: TourStep[] = [
  {
    title: 'Welcome to ClubIt! 👋',
    description: 'ClubIt is your school\'s hub for clubs, events, voting, and more. Let\'s take a quick look at where everything lives.',
  },
  {
    targetId: 'tour-nav-dashboard',
    title: 'My Clubs',
    description: 'Your home base. See every club you\'ve joined and quickly jump into any of them. Click it to continue.',
    tooltipSide: 'right',
    requiresClick: true,
    clickNavigates: true,
  },
  {
    targetId: 'tour-nav-clubs',
    title: 'All Clubs',
    description: 'Browse every club at your school. Search, filter by tag, and send a join request. Click it to continue.',
    tooltipSide: 'right',
    requiresClick: true,
    clickNavigates: true,
  },
  {
    targetId: 'tour-nav-events',
    title: 'Events',
    description: 'Stay up-to-date with upcoming club events. Both public events and private ones for clubs you\'re in will show here. Click it to continue.',
    tooltipSide: 'right',
    requiresClick: true,
    clickNavigates: true,
  },
  {
    targetId: 'tour-nav-elections',
    title: 'Elections & Forms',
    description: 'Cast votes in school-wide elections, participate in club leadership polls, and fill out club forms. Click it to continue.',
    tooltipSide: 'right',
    requiresClick: true,
    clickNavigates: true,
  },
  {
    targetId: 'tour-nav-chat',
    title: 'Chat',
    description: 'Message your club members. Each club you belong to has its own chat channel. Click it to continue.',
    tooltipSide: 'right',
    requiresClick: true,
    clickNavigates: true,
  },
  {
    targetId: 'tour-nav-profile',
    title: 'Your Profile',
    description: 'Edit your name, bio, and social links. Track your club memberships, attendance record, and earn achievements. Click it to continue.',
    tooltipSide: 'right',
    requiresClick: true,
    clickNavigates: true,
  },
  {
    targetId: 'tour-settings',
    title: 'Settings',
    description: 'Control your privacy — decide who can see your clubs, attendance, and achievements. Toggle dark mode, or report an issue. Click it to continue.',
    tooltipSide: 'bottom',
    requiresClick: true,
    clickNavigates: true,
  },
  {
    title: 'You\'re all set! 🎉',
    description: 'That\'s the full tour. You can restart this guide anytime by clicking the ? button in the sidebar. Happy exploring!',
  },
]

const ADVISOR_STEPS: TourStep[] = [
  {
    title: 'Welcome, Faculty Advisor! 👋',
    description: 'ClubIt gives you full control over your clubs. Let\'s walk through the key areas so you can hit the ground running.',
  },
  {
    targetId: 'tour-nav-dashboard',
    title: 'My Clubs',
    description: 'See all the clubs you advise. Click "My Clubs" to open your dashboard and explore your clubs.',
    tooltipSide: 'right',
    requiresClick: true,
    clickNavigates: true,
  },
  {
    targetId: 'tour-advisor-club-card',
    title: 'Managing a Club',
    description: 'Click on any club card to open its detail page, where you can edit the description, approve join requests, assign leadership roles, and toggle auto-accept.',
    tooltipSide: 'right',
    requiresClick: true,
    clickNavigates: true,
  },
  {
    targetId: 'tour-attendance-section',
    title: 'Attendance Tracking',
    description: 'Here is the Attendance section. Generate a QR code for students to scan when they arrive, or manually mark attendance for each session.',
    tooltipSide: 'top',
  },
  {
    targetId: 'tour-events-section',
    title: 'Events & Polls',
    description: 'Here is where you create club events (public or private), post club news, and run leadership polls — all from the club\'s detail page.',
    tooltipSide: 'right',
  },
  {
    targetId: 'tour-nav-chat',
    title: 'Chat',
    description: 'You automatically have access to the chat for every club you advise. Click it to continue.',
    tooltipSide: 'right',
    requiresClick: true,
    clickNavigates: true,
  },
  {
    targetId: 'tour-nav-elections',
    title: 'Elections & Forms',
    description: 'Participate in school-wide elections and view active forms. Advisors can also create polls directly from the club page. Click it to continue.',
    tooltipSide: 'right',
    requiresClick: true,
    clickNavigates: true,
  },
  {
    targetId: 'tour-nav-clubs',
    title: 'All Clubs',
    description: 'Browse and explore all clubs across the school — useful for cross-club collaboration. Click it to continue.',
    tooltipSide: 'right',
    requiresClick: true,
    clickNavigates: true,
  },
  {
    targetId: 'tour-settings',
    title: 'Settings',
    description: 'Adjust dark mode and report issues to the admin via the Settings panel. Click it to continue.',
    tooltipSide: 'bottom',
    requiresClick: true,
    clickNavigates: true,
  },
  {
    title: 'You\'re ready! 🎓',
    description: 'That covers the core advisor workflow. Tap the ? button in the sidebar anytime to replay this tour.',
  },
]

// ── Context ────────────────────────────────────────────────────────────────

interface TourContextValue {
  startTour: () => void
}

const TourContext = createContext<TourContextValue>({ startTour: () => {} })
export const useTour = () => useContext(TourContext)

// ── Helper: measure element ────────────────────────────────────────────────

const PADDING = 10

function getRect(targetId: string): SpotlightRect | null {
  if (typeof window === 'undefined') return null
  const el = document.querySelector(`[data-tour-id="${targetId}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    top: r.top - PADDING,
    left: r.left - PADDING,
    width: r.width + PADDING * 2,
    height: r.height + PADDING * 2,
  }
}

// ── Tour overlay component ─────────────────────────────────────────────────

function TourOverlay({
  steps,
  role,
  initialStep,
  onClose,
}: {
  steps: TourStep[]
  role: string
  initialStep: number
  onClose: () => void
}) {
  const [stepIdx, setStepIdx] = useState(initialStep)
  const [rect, setRect] = useState<SpotlightRect | null>(null)
  const [clicked, setClicked] = useState(false)
  const rafRef = useRef<number>(0)

  const step = steps[stepIdx]
  const isFirst = stepIdx === 0
  const isLast = stepIdx === steps.length - 1
  const needsClick = !!step.requiresClick && !!step.targetId
  const canAdvance = !needsClick || clicked

  // Persist state whenever stepIdx changes
  useEffect(() => {
    saveTourState(role, stepIdx)
  }, [role, stepIdx])

  // Reset clicked state when step changes
  useEffect(() => {
    setClicked(false)
  }, [stepIdx])

  // Scroll target element into view when step changes
  useEffect(() => {
    if (!step.targetId) return
    // Poll briefly in case the element isn't mounted yet (e.g. after navigation)
    let attempts = 0
    const interval = setInterval(() => {
      const el = document.querySelector(`[data-tour-id="${step.targetId}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        clearInterval(interval)
      } else if (++attempts > 20) {
        clearInterval(interval)
      }
    }, 100)
    return () => clearInterval(interval)
  }, [stepIdx, step.targetId])

  // Re-measure the target element each frame
  useEffect(() => {
    function measure() {
      if (step.targetId) {
        const r = getRect(step.targetId)
        setRect(r)
      } else {
        setRect(null)
      }
      rafRef.current = requestAnimationFrame(measure)
    }
    rafRef.current = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(rafRef.current)
  }, [step.targetId])

  // Attach click listener to target element for gated steps
  useEffect(() => {
    if (!needsClick || !step.targetId) return

    function handleTargetClick() {
      setClicked(true)
      if (step.clickNavigates) {
        // Advance after a brief delay to let navigation begin
        setTimeout(() => {
          setStepIdx((i) => {
            const next = i + 1
            if (next >= steps.length) {
              clearTourState()
              onClose()
              return i
            }
            return next
          })
        }, 150)
      }
    }

    // Poll for the element (it may not be mounted yet)
    let el = document.querySelector(`[data-tour-id="${step.targetId}"]`)
    const interval = setInterval(() => {
      el = document.querySelector(`[data-tour-id="${step.targetId}"]`)
      if (el) {
        el.addEventListener('click', handleTargetClick, { once: true })
        clearInterval(interval)
      }
    }, 100)

    // Also immediately attach if element already exists
    if (el) {
      el.addEventListener('click', handleTargetClick, { once: true })
      clearInterval(interval)
    }

    return () => {
      clearInterval(interval)
      const target = document.querySelector(`[data-tour-id="${step.targetId}"]`)
      if (target) target.removeEventListener('click', handleTargetClick)
    }
  }, [stepIdx, step.targetId, needsClick, step.clickNavigates, steps.length, onClose])

  function advance() {
    if (!canAdvance) return
    if (isLast) {
      clearTourState()
      onClose()
    } else {
      setStepIdx((i) => i + 1)
    }
  }

  function retreat() {
    setStepIdx((i) => i - 1)
  }

  function handleClose() {
    clearTourState()
    onClose()
  }

  // Tooltip positioning
  function getTooltipStyle(): React.CSSProperties {
    if (!rect || !step.targetId) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10001,
        width: 380,
      }
    }

    const side = step.tooltipSide ?? 'right'
    const GAP = 16

    if (side === 'right') {
      const tooltipWidth = 300
      const tooltipHeight = 260
      const margin = 12
      const clampedTop = Math.min(rect.top, window.innerHeight - tooltipHeight - margin)
      const idealLeft = rect.left + rect.width + GAP
      // If there's not enough room to the right, flip to the left of the spotlight
      const clampedLeft = idealLeft + tooltipWidth + margin > window.innerWidth
        ? Math.max(margin, rect.left - tooltipWidth - GAP)
        : idealLeft
      return {
        position: 'fixed',
        top: Math.max(margin, clampedTop),
        left: clampedLeft,
        zIndex: 10001,
        width: tooltipWidth,
      }
    }
    if (side === 'bottom') {
      const tooltipWidth = 300
      const margin = 12
      const clampedLeft = Math.min(rect.left, window.innerWidth - tooltipWidth - margin)
      return {
        position: 'fixed',
        top: rect.top + rect.height + GAP,
        left: Math.max(margin, clampedLeft),
        zIndex: 10001,
        width: tooltipWidth,
      }
    }
    // top
    return {
      position: 'fixed',
      bottom: window.innerHeight - rect.top + GAP,
      left: rect.left,
      zIndex: 10001,
      width: 300,
    }
  }

  const progress = ((stepIdx + 1) / steps.length) * 100

  return (
    <>
      {/* Dark overlay */}
      {!rect && (
        <div
          className="fixed inset-0"
          style={{ background: 'rgba(0,0,0,0.75)', zIndex: 9999 }}
          onClick={handleClose}
        />
      )}

      {/* Spotlight box */}
      {rect && (
        <div
          style={{
            position: 'fixed',
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            borderRadius: 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.75)',
            zIndex: 9999,
            pointerEvents: 'none',
            border: needsClick && !clicked
              ? '2px solid rgba(255,180,0,0.8)'
              : '2px solid rgba(0,120,255,0.6)',
            transition: 'top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease',
          }}
        />
      )}

      {/* Tooltip card */}
      <div style={getTooltipStyle()}>
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#ffffff', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '1px solid rgba(0,88,190,0.15)' }}
        >
          {/* Progress bar */}
          <div className="h-1 w-full" style={{ background: '#e8ecf0' }}>
            <div
              className="h-1 transition-all duration-300"
              style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #0058be, #2170e4)' }}
            />
          </div>

          <div className="p-5">
            {/* Step counter */}
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
              Step {stepIdx + 1} of {steps.length}
            </p>

            {/* Title */}
            <h3 className="text-base font-bold text-gray-900 mb-2 leading-snug"
              style={{ fontFamily: 'var(--font-manrope)' }}>
              {step.title}
            </h3>

            {/* Description */}
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              {step.description}
            </p>

            {/* Click hint */}
            {needsClick && !clicked && (
              <p className="text-xs font-semibold text-amber-600 mb-4">
                Click the highlighted element to continue.
              </p>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={handleClose}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Skip tour
              </button>
              <div className="flex gap-2">
                {!isFirst && !needsClick && (
                  <button
                    onClick={retreat}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                )}
                {/* Show Next/Done only for non-gated steps or already-clicked gated steps */}
                {!needsClick && (
                  isLast ? (
                    <button
                      onClick={handleClose}
                      className="px-5 py-2 rounded-xl text-xs font-bold text-white transition-colors"
                      style={{ background: '#0058be' }}
                    >
                      Done!
                    </button>
                  ) : (
                    <button
                      onClick={advance}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors"
                      style={{ background: '#0058be' }}
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Arrow indicator */}
        {rect && step.tooltipSide === 'right' && (
          <div
            style={{
              position: 'absolute',
              top: 20,
              left: -8,
              width: 0,
              height: 0,
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderRight: '8px solid #ffffff',
              filter: 'drop-shadow(-2px 0 2px rgba(0,0,0,0.1))',
            }}
          />
        )}
      </div>
    </>
  )
}

// ── Provider ───────────────────────────────────────────────────────────────

export function HelpTourProvider({
  children,
  role,
}: {
  children: React.ReactNode
  role: 'student' | 'advisor' | 'admin'
}) {
  const [active, setActive] = useState(false)
  const [resumeStep, setResumeStep] = useState(0)

  const steps = role === 'advisor' ? ADVISOR_STEPS : STUDENT_STEPS

  // On mount, resume in-progress tour if any
  useEffect(() => {
    const saved = loadTourState()
    if (saved && saved.role === role && saved.stepIdx > 0 && saved.stepIdx < steps.length) {
      setResumeStep(saved.stepIdx)
      setActive(true)
    }
  }, [role, steps.length])

  const startTour = useCallback(() => {
    clearTourState()
    setResumeStep(0)
    setActive(true)
  }, [])

  return (
    <TourContext.Provider value={{ startTour }}>
      {children}
      {active && role !== 'admin' && (
        <TourOverlay
          steps={steps}
          role={role}
          initialStep={resumeStep}
          onClose={() => setActive(false)}
        />
      )}
    </TourContext.Provider>
  )
}

// ── Help button (rendered in sidebar) ─────────────────────────────────────

export function HelpButton() {
  const { startTour } = useTour()

  return (
    <button
      onClick={startTour}
      data-tour-id="tour-help-btn"
      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 w-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    >
      <HelpCircle style={{ width: '1.1rem', height: '1.1rem' }} className="shrink-0" />
      <span className="text-xs font-semibold uppercase tracking-widest">Help</span>
    </button>
  )
}
