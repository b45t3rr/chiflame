import { useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { FlowHeader, GateFrame, Page } from "@/components/page"
import { isIos, isStandalone, pushSupported } from "@/lib/platform"
import { useSession } from "@/state/session"
import { startEnablePush, warmServiceWorker } from "@/lib/push"
import { createVaultWithPasskey } from "@/lib/vault"

export function OnboardingPage() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const next = params.get("next")
  const { setVault, vault } = useSession()
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const skipInstall = isStandalone()
  const noPush = !pushSupported()

  const goAfterVault = () => {
    if (next) {
      nav(next)
      return
    }
    setStep(skipInstall ? (noPush ? 4 : 3) : 2)
  }

  async function submitVault() {
    setErr(null)
    setBusy(true)
    try {
      const v = await createVaultWithPasskey()
      setVault(v)
      goAfterVault()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error"
      if (/notallowed|abort|cancel/i.test(msg)) setErr("Cancelado.")
      else setErr(msg)
    } finally {
      setBusy(false)
    }
  }

  async function onEnablePush() {
    if (!vault || !pushSupported()) {
      setStep(4)
      return
    }
    await warmServiceWorker()
    const res = await startEnablePush(vault.deviceId)
    if (!res.ok && res.reason && res.reason !== "denied" && res.reason !== "default") {
      setErr(res.reason === "no_sw" ? "Reinstalá la app desde el icono (falta el service worker)." : res.reason)
    }
    setStep(4)
  }

  const title = useMemo(
    () => ["Configurá tu dispositivo", "Instalá la app", "Activá las notificaciones", "Vault listo"][step - 1],
    [step],
  )

  return (
    <GateFrame>
      <Page className="flex min-h-[75dvh] flex-1 flex-col justify-between py-6">
        <div>
          <FlowHeader step={step} total={4} eyebrow="Configuración segura" title={title} />

          {step === 1 && (
            <div className="mt-6 space-y-4">
              <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
                Configurá tu llave biométrica (Face ID, Touch ID, o el llavero de tu sistema). Tus credenciales criptográficas se derivan y se guardan localmente en el chip seguro de este dispositivo.
              </p>
              {err && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {err}
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="mt-6 space-y-3">
              <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
                Para recibir notificaciones cuando la app esté cerrada en dispositivos móviles (especialmente en iOS), agregá Chiflame a tu pantalla de inicio.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="mt-6 space-y-3">
              <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
                Habilitá los permisos del sistema para que las alertas cifradas te despierten el dispositivo. El contenido se descifra de manera segura en tu navegador.
              </p>
              {err && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {err}
                </p>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="mt-6 space-y-4">
              <p className="text-xs text-muted-foreground">
                Instalá la CLI en tu terminal para vincularla a este buzón:
              </p>
              <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/40 p-3.5 font-mono text-xs shadow-xs">
                <div className="min-w-0 flex-1">
                  <div className="text-muted-foreground select-none"># 1. Instalar y emparejar</div>
                  <div className="mt-1 text-accent font-medium">npm i -g chiflame</div>
                  <div className="mt-0.5 text-accent font-medium">chifla auth pair</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground ml-2"
                  aria-label="Copiar comandos"
                  onClick={async () => {
                    await navigator.clipboard.writeText("npm i -g chiflame && chifla auth pair")
                    setCopied(true)
                    toast.success("Comandos copiados")
                    setTimeout(() => setCopied(false), 2000)
                  }}
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Escaneá el código QR que se genere en tu consola con la cámara de este dispositivo.
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 pt-4">
          {step === 1 && (
            <div className="space-y-3">
              <Button className="w-full text-xs font-semibold" disabled={busy} onClick={() => void submitVault()}>
                {busy ? "Esperando autenticación…" : "Configurar credencial segura"}
              </Button>
              <p className="text-center font-mono text-[11px] text-muted-foreground/60">
                Protegido por WebAuthn / PRF
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <Button asChild className="w-full text-xs font-semibold">
                <Link to="/install?next=/onboarding">Instalar aplicación</Link>
              </Button>
              <Button variant="ghost" className="w-full text-xs" onClick={() => setStep(noPush ? 4 : 3)}>
                Omitir por ahora
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2">
              {isIos() && !isStandalone() ? (
                <>
                  <Button asChild className="w-full text-xs font-semibold">
                    <Link to="/install">Cómo instalar en iOS</Link>
                  </Button>
                  <Button variant="ghost" className="w-full text-xs" onClick={() => setStep(4)}>
                    Continuar sin push
                  </Button>
                </>
              ) : (
                <>
                  <Button className="w-full text-xs font-semibold" onClick={() => void onEnablePush()}>
                    Activar notificaciones push
                  </Button>
                  <Button variant="ghost" className="w-full text-xs" onClick={() => setStep(4)}>
                    Omitir
                  </Button>
                </>
              )}
            </div>
          )}

          {step === 4 && (
            <Button className="w-full text-xs font-semibold" onClick={() => nav("/inbox")}>
              Ir a la bandeja de entrada
            </Button>
          )}
        </div>
      </Page>
    </GateFrame>
  )
}
