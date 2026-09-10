import { useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeft, Check, Palette } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Page } from "@/components/page"
import { SettingsFrame } from "@/components/settings-frame"
import { supabase } from "@/lib/supabase"
import { channelColorName, channelColors, createChannel, slugify } from "@/lib/vault"
import { useSession } from "@/state/session"

export function SettingsChannelFormPage() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const isNew = !slug
  const nav = useNavigate()
  const { vault, setVault } = useSession()
  const existing = vault?.channels.find((c) => c.slug === slug)
  const initialName = existing?.name ?? params.get("name") ?? ""
  const [name, setName] = useState(initialName)
  const [sl, setSl] = useState(existing?.slug ?? (initialName ? slugify(initialName) : ""))
  const [color, setColor] = useState(existing?.color ?? channelColors()[0])
  const [icon, setIcon] = useState(existing?.icon ?? "")
  const [muted, setMuted] = useState(existing?.muted ?? false)
  const [ret, setRet] = useState(existing?.retention_days ?? 30)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!vault) return
    const cleanName = name.trim()
    const cleanSlug = sl.trim().toLowerCase()
    if (cleanName.length < 2) {
      toast.error("El nombre debe tener al menos 2 caracteres")
      return
    }
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(cleanSlug)) {
      toast.error("Usá un slug con letras minúsculas, números, guiones o guiones bajos")
      return
    }
    setBusy(true)
    try {
      if (isNew) {
        const ch = await createChannel(vault, { name: cleanName, slug: cleanSlug || slugify(cleanName), color, icon })
        setVault({ ...vault })
        nav(`/c/${ch.slug}`)
        return
      }
      if (!existing) return
      const { error: channelError } = await supabase
        .from("channels")
        .update({ name: cleanName, color, icon: icon || null, retention_days: ret })
        .eq("id", existing.id)
      if (channelError) throw new Error(channelError.message)
      const { error: memberError } = await supabase.from("channel_members").update({ muted }).eq("channel_id", existing.id).eq("user_id", vault.userId)
      if (memberError) throw new Error(memberError.message)
      existing.name = cleanName
      existing.color = color
      existing.icon = icon || null
      existing.muted = muted
      existing.retention_days = ret
      setVault({ ...vault })
      nav("/settings/channels")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!existing || existing.kind === "inbox") return
    if (!window.confirm(`¿Eliminar el canal “${existing.name || existing.slug}”?`)) return
    const { error } = await supabase.from("channels").delete().eq("id", existing.id)
    if (error) {
      toast.error(error.message)
      return
    }
    if (vault) {
      vault.channels = vault.channels.filter((c) => c.id !== existing.id)
      setVault({ ...vault })
    }
    nav("/settings/channels")
  }

  return (
    <SettingsFrame active="/settings/channels">
      <Page className="px-4 py-2">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => nav("/settings/channels")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Volver a canales</span>
          </button>
          <span className="text-xs font-semibold text-foreground">
            {isNew ? "Nuevo canal" : `#${slug}`}
          </span>
        </div>

        <div className="mt-6 rounded-lg border border-border/70 bg-card/40 p-5 shadow-sm space-y-5">
          {/* Channel Preview Banner */}
          <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/40 p-3">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
            <div className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-foreground">{name || "Nombre del canal"}</span>
              <span className="block font-mono text-[10px] text-muted-foreground">#{sl || "slug"}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="channel-name" className="text-xs font-medium">Nombre</Label>
            <Input
              id="channel-name"
              required
              value={name}
              placeholder="Ej. Deploys, Alertas, Servidor"
              onChange={(e) => {
                setName(e.target.value)
                if (isNew) setSl(slugify(e.target.value))
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="channel-slug" className="text-xs font-medium">Slug del canal</Label>
            <Input id="channel-slug" required value={sl} disabled={!isNew} onChange={(e) => setSl(e.target.value)} />
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs font-medium">Color identificador</Label>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {channelColors().map((c) => (
                <button
                  key={c}
                  type="button"
                  className="relative h-6 w-6 rounded-full transition-transform focus:outline-none"
                  aria-label={`Elegir color ${channelColorName(c)}`}
                  style={{
                    background: c,
                    boxShadow: c === color ? `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${c}` : undefined,
                    transform: c === color ? "scale(1.1)" : undefined,
                  }}
                  onClick={() => setColor(c)}
                >
                  {c === color && <Check className="absolute inset-0 m-auto h-3 w-3 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="channel-icon" className="text-xs font-medium">Etiqueta o emoji (opcional)</Label>
            <Input id="channel-icon" value={icon} placeholder="Ej. 🚀, ⚡, 🔔" onChange={(e) => setIcon(e.target.value.slice(0, 4))} />
          </div>

          {!isNew && (
            <div className="space-y-4 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-medium">Silenciar notificaciones</Label>
                  <p className="text-[11px] text-muted-foreground leading-tight">No emitir sonido ni vibración para este canal</p>
                </div>
                <Switch checked={muted} onCheckedChange={setMuted} />
              </div>

              <div>
                <Label className="text-xs font-medium">Retención de mensajes</Label>
                <div className="mt-2 flex gap-2">
                  {[7, 30, 90].map((n) => (
                    <Button
                      key={n}
                      type="button"
                      size="sm"
                      variant={ret === n ? "default" : "outline"}
                      className="h-7 px-3 text-xs"
                      onClick={() => setRet(n)}
                    >
                      {n} días
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 space-y-2">
            <Button className="w-full text-xs font-semibold h-9" disabled={busy} onClick={() => void save()}>
              {busy ? "Guardando…" : isNew ? "Crear canal" : "Guardar cambios"}
            </Button>
            {!isNew && existing?.kind !== "inbox" && (
              <Button
                variant="ghost"
                className="w-full text-xs text-destructive hover:bg-destructive/10 hover:text-destructive h-9"
                onClick={() => void remove()}
              >
                Eliminar canal
              </Button>
            )}
          </div>
        </div>
      </Page>
    </SettingsFrame>
  )
}
