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

export function FlowHeader({ step, total, eyebrow, title, description }: { step: number; total: number; eyebrow: string; title: string; description?: string }) {
  return <header className="space-y-4"><div className="flex gap-1" aria-label={`Paso ${step} de ${total}`}>{Array.from({ length: total }, (_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < step ? "bg-accent" : "bg-muted"}`} />)}</div><div><p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{eyebrow} · {step}/{total}</p><h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{title}</h1>{description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>}</div></header>
}
