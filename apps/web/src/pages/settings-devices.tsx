import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Check, Copy, Smartphone, Terminal } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Page } from "@/components/page"
import { SettingsFrame } from "@/components/settings-frame"
import { Skeleton } from "@/components/skeleton"
import { callFn } from "@/lib/supabase"
import { supabase } from "@/lib/supabase"
import { relativeTime } from "@/lib/time"
import { useSession } from "@/state/session"

type Dev = { id: string; kind: string; name: string; last_seen_at: string | null; revoked_at: string | null }

export function SettingsDevicesPage() {
  const { vault } = useSession()
  const [list, setList] = useState<Dev[]>([])
  const [target, setTarget] = useState<Dev | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedPair, setCopiedPair] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from("devices").select("*").is("revoked_at", null).order("created_at")
    if (error) setErr("No se pudieron cargar los dispositivos")
    else setList((data as Dev[]) ?? [])
    setLoading(false)
  }
  useEffect(() => {
    void load()
  }, [])

  return (
    <SettingsFrame active="/settings/devices">
      <Page className="px-4 py-2">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Configuración</span>
          </Link>
          <span className="font-mono text-[11px] text-muted-foreground">{list.length} autorizados</span>
        </div>

        <div className="mt-6">
          <h1 className="text-sm font-semibold tracking-tight text-foreground">Dispositivos vinculados</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Dispositivos autorizados para cifrar o recibir mensajes.</p>
        </div>

        {loading ? (
          <div aria-label="Cargando dispositivos" className="mt-4 space-y-2">
            {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-14 w-full rounded-md" />)}
          </div>
        ) : err && list.length === 0 ? (
          <div className="mt-6 py-8 text-center">
            <p className="text-xs text-destructive">{err}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>Reintentar</Button>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-border/70 bg-card/40 divide-y divide-border/50 shadow-sm">
            {list.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/60 text-muted-foreground">
                    {d.kind === "cli" ? <Terminal className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-medium text-foreground">{d.name}</span>
                      {d.id === vault?.deviceId && (
                        <span className="rounded bg-accent/20 px-1.5 py-0.2 font-mono text-[9px] font-medium text-accent">
                          este dispositivo
                        </span>
                      )}
                    </div>
                    <span className="block truncate font-mono text-[10px] text-muted-foreground mt-0.5">
                      {d.kind.toUpperCase()} · {d.last_seen_at ? relativeTime(d.last_seen_at) : "visto —"}
                    </span>
                  </div>
                </div>
                {d.kind === "cli" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 ml-2"
                    onClick={() => setTarget(d)}
                  >
                    Revocar
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between rounded-md border border-border/70 bg-muted/40 p-3 shadow-xs">
          <div className="min-w-0 flex-1 font-mono text-xs">
            <div className="text-[11px] text-muted-foreground"># Vincular otra terminal CLI:</div>
            <div className="mt-0.5 font-semibold text-accent truncate">chifla auth pair</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground ml-2"
            aria-label="Copiar comando de emparejamiento"
            onClick={async () => {
              await navigator.clipboard.writeText("chifla auth pair")
              setCopiedPair(true)
              toast.success("Comando copiado")
              setTimeout(() => setCopiedPair(false), 2000)
            }}
          >
            {copiedPair ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <Dialog
          open={!!target}
          onOpenChange={(open) => {
            if (!open && !busy) {
              setTarget(null)
              setErr(null)
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Revocar {target?.name}</DialogTitle>
              <DialogDescription>Esta CLI no va a poder mandar hasta un nuevo pair.</DialogDescription>
            </DialogHeader>
            {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" disabled={busy} onClick={() => setTarget(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                disabled={busy || !target}
                onClick={() => {
                  void (async () => {
                    if (!target) return
                    setBusy(true)
                    setErr(null)
                    const { status, data } = await callFn<{ error?: { message: string } }>("device-revoke", {
                      device_id: target.id,
                    })
                    setBusy(false)
                    if (status >= 400) {
                      setErr(data.error?.message ?? `No se pudo revocar (${status})`)
                      return
                    }
                    toast("CLI revocada")
                    setTarget(null)
                    void load()
                  })()
                }}
              >
                {busy ? "…" : "Revocar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Page>
    </SettingsFrame>
  )
}
