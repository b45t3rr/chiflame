import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Page } from "@/components/page"
import { SettingsFrame } from "@/components/settings-frame"
import { APP_VERSION } from "@/lib/env"
import { callFn } from "@/lib/supabase"
import { useSession } from "@/state/session"
import { useState } from "react"

const rows = [
  { to: "/settings/devices", label: "Dispositivos" },
  { to: "/settings/channels", label: "Canales" },
  { to: "/settings/notifications", label: "Notificaciones" },
  { to: "/settings/security", label: "Seguridad" },
  { to: "/settings/appearance", label: "Apariencia" },
]

export function SettingsPage() {
  const { vault, signOutLocal } = useSession()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  return (
    <SettingsFrame active="/settings">
      <Page className="px-4 py-2">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <Link
            to="/inbox"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Volver al buzón</span>
          </Link>
          <span className="text-xs font-semibold text-foreground">Configuración</span>
        </div>

        <div className="mt-6 rounded-lg border border-border/70 bg-card/40 divide-y divide-border/50 overflow-hidden shadow-sm">
          {rows.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className="flex items-center justify-between px-4 py-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
            >
              <span>{r.label}</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          ))}
        </div>

        <div className="mt-6">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
            onClick={() => setOpen(true)}
          >
            Desvincular este dispositivo
          </Button>
          <p className="mt-4 text-center font-mono text-[10px] text-muted-foreground/60">chiflame v{APP_VERSION}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Desvincular este dispositivo?</DialogTitle>
              <DialogDescription>Deja de recibir notificaciones acá. El vault no se borra.</DialogDescription>
            </DialogHeader>
            {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" disabled={busy} onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true)
                    setErr(null)
                    if (vault) {
                      const { status, data } = await callFn<{ error?: { message: string } }>("device-revoke", {
                        device_id: vault.deviceId,
                      })
                      if (status >= 400) {
                        setBusy(false)
                        setErr(data.error?.message ?? `No se pudo desvincular (${status})`)
                        return
                      }
                    }
                    await signOutLocal()
                    nav("/")
                  })()
                }}
              >
                {busy ? "…" : "Desvincular"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Page>
    </SettingsFrame>
  )
}
