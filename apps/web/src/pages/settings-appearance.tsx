import { Link } from "react-router-dom"
import { ArrowLeft, Check, Moon, Monitor, Sun } from "lucide-react"
import { Page } from "@/components/page"
import { SettingsFrame } from "@/components/settings-frame"
import { useSession } from "@/state/session"
import type { ThemePref } from "@/lib/idb"
import { cn } from "@/lib/utils"

const opts: { id: ThemePref; label: string; icon: typeof Moon }[] = [
  { id: "system", label: "Automático (Sistema)", icon: Monitor },
  { id: "dark", label: "Oscuro (Obsidian)", icon: Moon },
  { id: "light", label: "Claro", icon: Sun },
]

export function SettingsAppearancePage() {
  const { theme, setTheme } = useSession()
  return (
    <SettingsFrame active="/settings/appearance">
      <Page className="px-4 py-2">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Configuración</span>
          </Link>
          <span className="text-xs font-semibold text-foreground">Apariencia</span>
        </div>

        <div className="mt-6">
          <h1 className="text-sm font-semibold tracking-tight text-foreground">Tema visual</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Elegí el esquema de color de la interfaz.</p>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-border/70 bg-card/40 divide-y divide-border/50 shadow-sm">
          {opts.map((o) => {
            const Icon = o.icon
            const active = theme === o.id
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setTheme(o.id)}
                className={cn(
                  "flex w-full items-center justify-between px-4 py-3 text-left transition-colors text-xs font-medium",
                  active ? "bg-muted/60 text-foreground" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  <span>{o.label}</span>
                </div>
                {active && <Check className="h-3.5 w-3.5 text-accent" />}
              </button>
            )
          })}
        </div>
      </Page>
    </SettingsFrame>
  )
}

