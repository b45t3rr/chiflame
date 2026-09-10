import { motion } from "motion/react"
import type { ReactNode } from "react"

export function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function GateFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto flex min-h-[100dvh] w-full max-w-md flex-1 flex-col px-6 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))] ${className}`}>
      {children}
    </div>
  )
}

export function AppFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`app-frame flex min-h-[100dvh] w-full flex-col pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] ${className}`}>
      {children}
    </div>
  )
}
