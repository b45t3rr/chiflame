import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Bell, Check, LockKeyhole, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Page } from "@/components/page"
import { SettingsFrame } from "@/components/settings-frame"
import { isIos, isStandalone, pushSupported } from "@/lib/platform"
import { osNotificationPermission, pushFailureCopy, pushWorkerReady, startEnablePush, warmServiceWorker } from "@/lib/push"
import { useSession } from "@/state/session"

export function SettingsNotificationsPage() {
  const { previewOn, setPreview, vault } = useSession()
  const iosTab = isIos() && !isStandalone()
  const supported = pushSupported()
  const [perm, setPerm] = useState(osNotificationPermission())
  const [busy, setBusy] = useState(false)
  const [swOk, setSwOk] = useState(pushWorkerReady())
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    void warmServiceWorker().then((reg) => setSwOk(Boolean(reg?.active)))
  }, [])

  return (
    <SettingsFrame active="/settings/notifications">
      <Page className="px-4 py-2">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Configuración</span>
          </Link>
          <span className="text-xs font-semibold text-foreground">Notificaciones</span>
        </div>

        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-border/70 bg-card/40 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-xs font-semibold text-foreground">Estado de entrega local</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${perm === "granted" && swOk ? "bg-accent" : "bg-muted-foreground"}`} />
                <span className="font-mono text-[11px] text-muted-foreground">
                  {!supported || iosTab ? "No disponible" : perm === "granted" && swOk ? "Activo" : perm === "denied" ? "Bloqueado" : "Pendiente"}
                </span>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              {!supported || iosTab
                ? "Instalá la aplicación en tu pantalla de inicio para habilitar notificaciones push."
                : "Las notificaciones se envían cifradas y el service worker las descifra en este hardware antes de mostrarlas."}
            </p>

            {iosTab && (
              <Button asChild variant="outline" size="sm" className="w-full text-xs">
                <Link to="/install">Instrucciones para iOS</Link>
              </Button>
            )}

            {supported && !iosTab && (
              <Button
                size="sm"
                className="w-full text-xs font-semibold h-9"
                disabled={busy || !vault || !swOk}
                onClick={() => {
                  if (!vault) return
                  setBusy(true)
                  setMsg(null)
                  const run = startEnablePush(vault.deviceId)
                  void run
                    .then((res) => {
                      if (res.ok) setMsg("Listo. Notificaciones autorizadas.")
                      else setMsg(pushFailureCopy(res.reason))
                    })
                    .catch((e) => setMsg(pushFailureCopy(e instanceof Error ? e.message : "error")))
                    .finally(() => {
                      setPerm(osNotificationPermission())
                      setBusy(false)
                    })
                }}
              >
                {busy ? "Configurando…" : !swOk ? "Preparando service worker…" : perm === "granted" ? "Actualizar registro push" : perm === "denied" ? "Permiso denegado por el navegador" : "Habilitar notificaciones"}
              </Button>
            )}
            {msg && <p className="text-xs font-mono text-muted-foreground">{msg}</p>}
          </div>

          <div className="rounded-lg border border-border/70 bg-card/40 p-5 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-1.5">
                  <LockKeyhole className="h-3.5 w-3.5 text-accent" />
                  <h2 className="text-xs font-semibold text-foreground">Vista previa privada</h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Descifra el título y contenido en pantalla de bloqueo. Si está desactivada, solo dirá “Nuevo mensaje”.
                </p>
              </div>
              <Switch checked={previewOn} onCheckedChange={setPreview} />
            </div>

            <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/40 p-3">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-background text-foreground shadow-xs">
                <Bell className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] text-muted-foreground">chiflame · ahora</p>
                <p className="truncate text-xs font-medium text-foreground">
                  {previewOn ? "Deploy completado exitosamente (v2.4.0)" : "Nuevo mensaje"}
                </p>
              </div>
              <Check className="h-3.5 w-3.5 text-accent" />
            </div>
          </div>
        </div>
      </Page>
    </SettingsFrame>
  )
}
