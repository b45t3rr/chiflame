import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Fingerprint } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GateFrame, Page } from "@/components/page"
import { Mark } from "@/components/mark"
import { useSession } from "@/state/session"

export function UnlockPage() {
  const { unlockPasskey, gate } = useSession()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (gate === "guest") nav("/", { replace: true })
  }, [gate, nav])

  async function onUnlock() {
    setBusy(true)
    setErr(null)
    try {
      await unlockPasskey()
      nav(params.get("next") || "/inbox", { replace: true })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo desbloquear"
      if (/notallowed|abort|cancel/i.test(msg)) setErr("Cancelado.")
      else setErr(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <GateFrame>
      <Page className="flex min-h-[80dvh] flex-1 flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-lg border border-border/80 bg-card/60 p-6 sm:p-8 shadow-xl backdrop-blur-sm">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border/70 bg-muted/60">
                <Mark className="h-6 w-6" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-accent" />
              </span>
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              Desbloquear vault
            </h1>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Autenticate con la credencial biométrica o clave de este dispositivo para descifrar tu buzón.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            {err && (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {err}
              </p>
            )}
            <Button
              className="h-10 w-full text-xs font-semibold"
              disabled={busy}
              onClick={() => void onUnlock()}
            >
              {busy ? "Esperando autenticación…" : "Desbloquear"}
            </Button>
            <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
              <Fingerprint className="h-3.5 w-3.5" />
              <span>Face ID, Touch ID o PIN local</span>
            </div>
          </div>
        </div>
        <p className="mt-6 font-mono text-[11px] text-muted-foreground/60 text-center">
          chiflame · hardware-bound encryption
        </p>
      </Page>
    </GateFrame>
  )
}
