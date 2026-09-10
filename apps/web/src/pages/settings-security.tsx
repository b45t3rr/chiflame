import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Page } from "@/components/page"
import { SettingsFrame } from "@/components/settings-frame"
import { supabase } from "@/lib/supabase"
import { authHashFromMaster, deriveMasterKey, unwrapSecret, wrapSecret, type KdfParams } from "@chiflame/crypto"
import { rotateDevicePasskey } from "@/lib/vault"
import { useSession } from "@/state/session"

export function SettingsSecurityPage() {
  const { vault } = useSession()
  const [step, setStep] = useState<"choose" | "passphrase" | "passkey" | "done">("choose")
  const [cur, setCur] = useState("")
  const [n1, setN1] = useState("")
  const [n2, setN2] = useState("")
  const [busy, setBusy] = useState(false)
  const [vaultMode, setVaultMode] = useState<"passkey" | "passphrase" | "loading">("loading")

  useEffect(() => {
    if (!vault) return
    void supabase.from("profiles").select("kdf").eq("id", vault.userId).single().then(({ data }) => {
      const alg = (data?.kdf as { alg?: string } | null)?.alg
      setVaultMode(alg === "webauthn-prf" || alg === "device-local" ? "passkey" : "passphrase")
    })
  }, [vault])

  async function changePass() {
    if (!vault || n1.length < 12 || n1 !== n2) {
      toast.error("Revisá la passphrase nueva")
      return
    }
    setBusy(true)
    try {
      const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", vault.userId).single()
      if (profileError || !profile) throw new Error("No se pudo cargar la configuración de seguridad")
      const master = deriveMasterKey(cur, profile.kdf as KdfParams)
      unwrapSecret(master, profile.wrapped_user_key)
      const nextMaster = deriveMasterKey(n1, profile.kdf as KdfParams)
      const wrapped = wrapSecret(nextMaster, vault.userKey)
      const { error: profileUpdateError } = await supabase.from("profiles").update({ wrapped_user_key: wrapped }).eq("id", vault.userId)
      if (profileUpdateError) throw new Error(profileUpdateError.message)
      const { error: authError } = await supabase.auth.updateUser({ password: authHashFromMaster(nextMaster) })
      if (authError) throw new Error(authError.message)
      toast.success("Passphrase actualizada")
      setCur("")
      setN1("")
      setN2("")
      setStep("done")
    } catch (e) {
      toast.error(e instanceof Error && e.message === "Passphrase incorrecta" ? e.message : "No se pudo actualizar la passphrase")
    } finally {
      setBusy(false)
    }
  }

  async function changePasskey() {
    if (!vault) return
    setBusy(true)
    try {
      await rotateDevicePasskey(vault)
      toast.success("Passkey renovada")
      setStep("done")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo renovar la passkey")
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsFrame active="/settings/security">
      <Page className="px-4 py-2">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Configuración</span>
          </Link>
          <span className="text-xs font-semibold text-foreground">Seguridad</span>
        </div>

        <div className="mt-6">
          <h1 className="text-sm font-semibold tracking-tight text-foreground">Seguridad y acceso</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Gestioná las credenciales criptográficas de este dispositivo.</p>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-border/70 bg-card/40 p-5 shadow-sm">
          {step === "choose" && vaultMode === "loading" && (
            <div className="text-xs text-muted-foreground">Cargando estado de seguridad…</div>
          )}

          {step === "choose" && vaultMode !== "loading" && (
            <div className="space-y-3">
              <button
                type="button"
                className="w-full rounded-md border border-border/70 p-3.5 text-left transition-colors hover:border-foreground/30 hover:bg-muted/40"
                onClick={() => setStep("passkey")}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  <span className="text-xs font-semibold text-foreground">Renovar passkey local</span>
                </div>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Registrá una nueva credencial biométrica (Face ID / Touch ID / Windows Hello) en este dispositivo.
                </span>
              </button>

              {vaultMode === "passphrase" ? (
                <button
                  type="button"
                  className="w-full rounded-md border border-border/70 p-3.5 text-left transition-colors hover:border-foreground/30 hover:bg-muted/40"
                  onClick={() => setStep("passphrase")}
                >
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">Cambiar frase de paso</span>
                  </div>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Re-encriptar la clave principal con una nueva passphrase de recuperación.
                  </span>
                </button>
              ) : (
                <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                  Este vault está vinculado mediante WebAuthn. Tu acceso está protegido por hardware seguro.
                </div>
              )}
            </div>
          )}

          {step === "passkey" && (
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Tu navegador solicitará confirmación biométrica o de seguridad para registrar una nueva passkey para Chiflame.
              </p>
              <div className="space-y-2">
                <Button className="w-full text-xs font-semibold h-9" disabled={busy} onClick={() => void changePasskey()}>
                  {busy ? "Esperando al sistema…" : "Comenzar registro de passkey"}
                </Button>
                <Button variant="ghost" className="w-full text-xs h-9" disabled={busy} onClick={() => setStep("choose")}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {step === "passphrase" && (
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="current-passphrase" className="text-xs font-medium">Passphrase actual</Label>
                <Input id="current-passphrase" autoComplete="current-password" type="password" value={cur} onChange={(e) => setCur(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-passphrase" className="text-xs font-medium">Passphrase nueva</Label>
                <Input id="new-passphrase" autoComplete="new-password" type="password" value={n1} onChange={(e) => setN1(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-passphrase" className="text-xs font-medium">Confirmar nueva passphrase</Label>
                <Input id="confirm-passphrase" autoComplete="new-password" type="password" value={n2} onChange={(e) => setN2(e.target.value)} />
              </div>
              <div className="pt-2 space-y-2">
                <Button className="w-full text-xs font-semibold h-9" disabled={busy} onClick={() => void changePass()}>{busy ? "Actualizando…" : "Actualizar passphrase"}</Button>
                <Button variant="ghost" className="w-full text-xs h-9" disabled={busy} onClick={() => setStep("choose")}>Cancelar</Button>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground/80 text-center font-mono">
                No existe recuperación centralizada. Guardala en un gestor seguro.
              </p>
            </div>
          )}

          {step === "done" && (
            <div className="py-4 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-accent font-semibold">
                ✓
              </div>
              <h2 className="mt-3 text-sm font-semibold tracking-tight text-foreground">Credencial actualizada</h2>
              <p className="mt-1 text-xs text-muted-foreground">La nueva clave ya protege este dispositivo.</p>
              <Button className="mt-5 w-full text-xs font-semibold h-9" onClick={() => setStep("choose")}>Listo</Button>
            </div>
          )}
        </div>
      </Page>
    </SettingsFrame>
  )
}
