import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FlowHeader, GateFrame, Page } from "@/components/page"
import { callFn } from "@/lib/supabase"
import { supabase } from "@/lib/supabase"
import { fingerprint, sealChannelsForCli } from "@/lib/vault"
import { useSession } from "@/state/session"

type PairingRpcRow = {
  id: string
  cli_public_key: string
  cli_name: string | null
  verify_code: string
  status: string
  expires_at: string
}

type PairState = "loading" | "confirm" | "working" | "done" | "expired" | "denied" | "not_found" | "mismatch" | "error"

export function PairPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const { gate, vault } = useSession()
  const [state, setState] = useState<PairState>("loading")
  const [code, setCode] = useState("")
  const [name, setName] = useState("cli")
  const [fp, setFp] = useState("")
  const [cliPub, setCliPub] = useState("")
  const [err, setErr] = useState("")

  useEffect(() => {
    if (gate === "guest") {
      nav(`/onboarding?next=/pair/${id}`, { replace: true })
      return
    }
    if (gate === "locked") {
      nav(`/unlock?next=/pair/${id}`, { replace: true })
      return
    }
    if (gate !== "unlocked" || !id) return
    void (async () => {
      const { data: raw, error } = await (supabase as any).rpc("get_pairing_session", { p_id: id }).maybeSingle()
      const data = raw as PairingRpcRow | null
      if (error || !data) {
        setState("not_found")
        return
      }
      if (data.status === "expired") {
        setState("expired")
        return
      }
      if (data.status === "denied") {
        setState("denied")
        return
      }
      const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""))
      if (hash && hash !== data.cli_public_key) {
        setState("mismatch")
        return
      }
      setCliPub(data.cli_public_key)
      setCode(data.verify_code)
      setName(data.cli_name ?? "cli")
      setFp(fingerprint(data.cli_public_key))
      setState("confirm")
    })()
  }, [gate, id, nav])

  async function confirm() {
    if (!vault || !id) return
    setState("working")
    setErr("")
    try {
      const sealed = await sealChannelsForCli(vault, cliPub)
      const { status, data } = await callFn<{ error?: { code: string; message: string } }>("pair-complete", {
        pairing_id: id,
        verify_code: code,
        device_name: name,
        channel_keys_sealed: sealed,
      })
      if (status >= 400) {
        const codeName = data.error?.code
        setErr(data.error?.message ?? codeName ?? `HTTP ${status}`)
        if (codeName === "pairing_expired") setState("expired")
        else if (codeName === "not_found") setState("not_found")
        else if (codeName === "forbidden") setState("mismatch")
        else setState("error")
        return
      }
      setState("done")
      setTimeout(() => nav("/inbox?paired=1"), 700)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo completar la vinculación")
      setState("error")
    }
  }

  async function deny() {
    if (!id) return
    const { status } = await callFn("pair-deny", { pairing_id: id })
    if (status >= 400) {
      setErr("No se pudo rechazar la vinculación. Intentá de nuevo.")
      setState("error")
      return
    }
    setState("denied")
  }

  const errCopy: Record<string, string> = {
    expired: "Este QR ya no sirve.",
    denied: "Rechazaste este pair.",
    not_found: "Sesión inválida.",
    mismatch: "El código no coincide con esta CLI.",
    error: err || "No se pudo completar la vinculación.",
  }

  return (
    <GateFrame>
      <Page className="py-6">
        <FlowHeader step={2} total={2} eyebrow="Emparejamiento seguro" title="Vincular CLI" description="Confirmá que esta terminal es la que querés autorizar." />

        {state === "loading" && (
          <div className="mt-8 h-28 animate-pulse rounded-md bg-muted/60" />
        )}

        {state === "confirm" || state === "working" ? (
          <div className="mt-6 space-y-4">
            <p className="text-xs text-muted-foreground">
              Comprobá que este código coincida exactamente con el de tu terminal:
            </p>
            <div className="rounded-md border border-border/70 bg-muted/40 py-4 text-center font-mono text-2xl font-bold tracking-[0.35em] text-foreground shadow-inner">
              {code.split("").join(" ")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="device-name" className="text-xs font-medium">Nombre del dispositivo</Label>
              <Input id="device-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-[11px] text-muted-foreground">
              <span className="font-mono text-[10px] uppercase text-muted-foreground/70">Huella de clave: </span>
              <span className="font-mono text-foreground/80">{fp}</span>
            </div>
            <div className="pt-2 space-y-2">
              <Button className="w-full text-xs font-semibold" disabled={state === "working"} onClick={() => void confirm()}>
                {state === "working" ? "Vinculando..." : "Confirmar vinculación"}
              </Button>
              <Button variant="ghost" className="w-full text-xs" disabled={state === "working"} onClick={() => void deny()}>
                Rechazar
              </Button>
            </div>
          </div>
        ) : null}

        {state === "done" && (
          <div className="mt-8 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-accent font-semibold">
              ✓
            </div>
            <p className="mt-3 text-base font-semibold tracking-tight">CLI vinculada con éxito.</p>
            <p className="mt-1 text-xs text-muted-foreground">Redirigiendo al buzón…</p>
          </div>
        )}

        {errCopy[state] && (
          <div className="mt-6 space-y-4">
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {errCopy[state]}
            </div>
            <p className="text-xs text-muted-foreground">En tu consola, volvé a ejecutar:</p>
            <div className="rounded-md border border-border/70 bg-muted/40 p-2.5 font-mono text-xs text-accent">
              chifla auth pair
            </div>
            <Button className="w-full text-xs font-semibold" onClick={() => nav("/inbox")}>
              Volver al inicio
            </Button>
          </div>
        )}
      </Page>
    </GateFrame>
  )
}
