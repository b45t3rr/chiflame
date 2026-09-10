import { Link } from "react-router-dom"
import { ArrowLeft, ChevronRight, Plus } from "lucide-react"
import { Page } from "@/components/page"
import { SettingsFrame } from "@/components/settings-frame"
import { Button } from "@/components/ui/button"
import { useSession } from "@/state/session"

export function SettingsChannelsPage() {
  const { vault } = useSession()
  return (
    <SettingsFrame active="/settings/channels">
      <Page className="px-4 py-2">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Configuración</span>
          </Link>
          <span className="font-mono text-[11px] text-muted-foreground">{vault?.channels.length ?? 0} canales</span>
        </div>

        <div className="mt-6">
          <h1 className="text-sm font-semibold tracking-tight text-foreground">Canales</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Organizá tus notificaciones por contexto o servicio.</p>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-border/70 bg-card/40 divide-y divide-border/50 shadow-sm">
          {vault?.channels.map((c) => (
            <Link
              key={c.id}
              to={`/settings/channels/${c.slug}`}
              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color ?? "#10b981" }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium text-foreground">{c.name || c.slug}</span>
                  {c.kind === "inbox" && (
                    <span className="rounded bg-muted px-1.5 py-0.2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      inbox
                    </span>
                  )}
                </div>
                <span className="block truncate font-mono text-[10px] text-muted-foreground mt-0.5">
                  #{c.slug} · {c.kind === "inbox" ? "canal base" : `${c.muted ? "silenciado · " : ""}${c.retention_days}d retención`}
                </span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>

        <div className="mt-5">
          <Button className="w-full text-xs font-semibold h-9" asChild>
            <Link to="/settings/channels/new">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Crear canal
            </Link>
          </Button>
        </div>
      </Page>
    </SettingsFrame>
  )
}
