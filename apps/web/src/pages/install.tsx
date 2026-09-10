import { Link, useSearchParams } from "react-router-dom"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { GateFrame, Page } from "@/components/page"
import { isIos, isStandalone } from "@/lib/platform"

import { ArrowLeft, Check, Download, Share } from "lucide-react"

export function InstallPage() {
  const [params] = useSearchParams()
  const back = params.get("next") || "/"
  const ios = isIos()
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone())

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  async function install() {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  return (
    <GateFrame>
      <Page className="py-6">
        <Link
          to={back}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Volver</span>
        </Link>

        <div className="mt-4">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            {ios ? "Instalar en iOS" : "Instalar aplicación"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Instalá Chiflame como aplicación web progresiva para recibir alertas nativas y soporte de notificaciones push en segundo plano.
          </p>
        </div>

        {installed ? (
          <div className="mt-6 rounded-lg border border-border/70 bg-card/40 p-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-accent">
              <Check className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">App ya instalada</p>
              <p className="text-[11px] text-muted-foreground">Chiflame ya está activa en este dispositivo.</p>
            </div>
          </div>
        ) : ios && !isStandalone() ? (
          <div className="mt-6 rounded-lg border border-border/70 bg-card/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Share className="h-3.5 w-3.5 text-accent" />
              <span>Pasos en Safari:</span>
            </div>
            <ol className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted font-mono text-[10px] text-foreground">1</span>
                <span>Tocá el botón <strong>Compartir</strong> en la barra de Safari.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted font-mono text-[10px] text-foreground">2</span>
                <span>Seleccioná <strong>“Agregar a la pantalla de inicio”</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted font-mono text-[10px] text-foreground">3</span>
                <span>Abrí Chiflame desde el icono recién creado.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted font-mono text-[10px] text-foreground">4</span>
                <span>Autorizá las notificaciones cuando te lo pida.</span>
              </li>
            </ol>
            <p className="pt-2 text-[11px] text-muted-foreground/70 border-t border-border/40">
              Nota: Apple restringe las notificaciones Push Web a PWAs abiertas desde la pantalla de inicio.
            </p>
          </div>
        ) : installPrompt ? (
          <div className="mt-6 rounded-lg border border-border/70 bg-card/40 p-5 space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Hacé clic abajo para añadir Chiflame a tus aplicaciones de escritorio o móviles.
            </p>
            <Button className="w-full text-xs font-semibold h-9 gap-1.5" onClick={() => void install()}>
              <Download className="h-3.5 w-3.5" /> Instalar Chiflame
            </Button>
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-border/70 bg-card/40 p-4 text-xs text-muted-foreground leading-relaxed">
            En el menú de tu navegador elegí <strong>“Instalar Chiflame”</strong> o <strong>“Agregar a pantalla de inicio”</strong>.
          </div>
        )}

        <div className="mt-6">
          <Button asChild variant="outline" size="sm" className="w-full text-xs">
            <Link to={back}>Volver</Link>
          </Button>
        </div>
      </Page>
    </GateFrame>
  )
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}
