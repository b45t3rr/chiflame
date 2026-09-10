import { Link } from "react-router-dom"
import type { ReactNode } from "react"
import { AppFrame } from "@/components/page"

import { Mark } from "@/components/mark"

const items = [
  ["/settings", "Resumen"],
  ["/settings/channels", "Canales"],
  ["/settings/devices", "Dispositivos"],
  ["/settings/notifications", "Notificaciones"],
  ["/settings/security", "Seguridad"],
  ["/settings/appearance", "Apariencia"],
] as const

export function SettingsFrame({ active, children }: { active: string; children: ReactNode }) {
  return (
    <AppFrame>
      <div className="settings-layout">
        <aside className="settings-rail" aria-label="Navegación de configuración">
          <Link to="/inbox" className="settings-rail-brand hover:opacity-80 transition-opacity">
            <Mark className="h-5 w-5" />
            <span className="font-medium tracking-tight text-foreground">chiflame</span>
          </Link>
          <p className="settings-rail-label">Configuración</p>
          <nav className="space-y-1">
            {items.map(([to, label]) => <Link key={to} to={to} className={`settings-rail-link ${active === to ? "is-active" : ""}`}>{label}</Link>)}
          </nav>
        </aside>
        <main className="settings-content">{children}</main>
      </div>
    </AppFrame>
  )
}
