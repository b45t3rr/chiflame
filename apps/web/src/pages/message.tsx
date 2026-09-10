import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Check, Copy, ExternalLink, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { AppFrame, Page } from "@/components/page"
import { Skeleton } from "@/components/skeleton"
import { supabase } from "@/lib/supabase"
import { relativeTime } from "@/lib/time"
import { decryptRow } from "@/lib/vault"
import { useSession } from "@/state/session"

export function MessagePage() {
  const { slug = "inbox", messageId = "" } = useParams()
  const nav = useNavigate()
  const { vault } = useSession()
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [meta, setMeta] = useState("")
  const [click, setClick] = useState<string | null>(null)
  const [priority, setPriority] = useState("")
  const [from, setFrom] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!vault) return
    setLoading(true)
    setLoadError(null)
    try {
      const { data: ack, error: ackLoadError } = await supabase
        .from("message_acks")
        .select("deleted_at")
        .eq("message_id", messageId)
        .eq("user_id", vault.userId)
        .maybeSingle()
      if (ackLoadError) throw ackLoadError
      if (ack?.deleted_at) {
        toast("Ese mensaje ya fue borrado")
        nav(slug === "inbox" ? "/inbox" : `/c/${slug}`, { replace: true })
        return
      }

      const { data: m, error: messageError } = await supabase.from("messages").select("*").eq("id", messageId).maybeSingle()
      if (messageError) throw messageError
      if (!m) {
        toast.error("Mensaje no encontrado")
        nav(slug === "inbox" ? "/inbox" : `/c/${slug}`, { replace: true })
        return
      }
      const expectedChannel = slug === "inbox" ? vault.channels.find((candidate) => candidate.kind === "inbox") : vault.channels.find((candidate) => candidate.slug === slug)
      if (!expectedChannel || m.channel_id !== expectedChannel.id) {
        toast.error("Mensaje no encontrado en este canal")
        nav(slug === "inbox" ? "/inbox" : `/c/${slug}`, { replace: true })
        return
      }
      const pt = decryptRow(vault, m)
      setTitle(pt?.title || "Sin título")
      setBody(pt?.body ?? "No se pudo descifrar")
      setClick(pt?.click?.startsWith("https:") ? pt.click : null)
      setPriority(m.priority)
      setMeta(relativeTime(m.created_at))
      const { data: d } = await supabase.from("devices").select("name").eq("id", m.sender_device_id).maybeSingle()
      setFrom(d?.name ?? "CLI")
      const { error: ackError } = await supabase.from("message_acks").upsert({
        message_id: m.id,
        user_id: vault.userId,
        read_at: new Date().toISOString(),
      })
      if (ackError) throw ackError
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "No se pudo cargar el mensaje")
    } finally {
      setLoading(false)
    }
  }, [vault, messageId, nav, slug])

  useEffect(() => {
    void load()
  }, [load])

  async function copyContent() {
    if (!body) return
    const textToCopy = title && title !== "Sin título" ? `${title}\n\n${body}` : body
    await navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    toast.success("Mensaje copiado al portapapeles")
    setTimeout(() => setCopied(false), 2000)
  }

  async function del() {
    if (!vault) return
    const { error } = await supabase.from("message_acks").upsert({
      message_id: messageId,
      user_id: vault.userId,
      deleted_at: new Date().toISOString(),
    })
    if (error) {
      toast.error("No se pudo borrar el mensaje")
      return
    }
    toast("Borrado.", {
      action: {
        label: "Deshacer",
        onClick: () => {
          void supabase.from("message_acks").upsert({ message_id: messageId, user_id: vault.userId, deleted_at: null }).then(({ error: undoError }) => {
            if (undoError) toast.error("No se pudo deshacer el borrado")
          })
        },
      },
      duration: 5000,
    })
    nav(slug === "inbox" ? "/inbox" : `/c/${slug}`)
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        nav(slug === "inbox" ? "/inbox" : `/c/${slug}`)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [nav, slug])

  return (
    <AppFrame>
      <Page className="mx-auto w-full max-w-2xl px-4 py-2">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <Link
            to={slug === "inbox" ? "/inbox" : `/c/${slug}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Volver a #{slug}</span>
          </Link>
          {!loading && !loadError && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => void copyContent()}
                aria-label="Copiar texto del mensaje"
              >
                {copied ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? "Copiado" : "Copiar"}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => void del()}
                aria-label="Borrar mensaje"
              >
                <Trash2 className="h-3 w-3" />
                <span>Borrar</span>
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <div aria-label="Cargando mensaje" className="mt-6 space-y-4">
            <Skeleton className="h-7 w-3/5" />
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-36 w-full rounded-md" />
          </div>
        ) : loadError ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-foreground">No pudimos cargar el mensaje.</p>
            <p className="mt-1 text-xs text-muted-foreground">Revisá la conexión e intentá de nuevo.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void load()}>
              Reintentar
            </Button>
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-border/60 bg-card/40 p-5 shadow-sm">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">{title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                origen: {from}
              </span>
              <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                {meta}
              </span>
              {priority && (
                <span
                  className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[10px] font-medium ${
                    priority === "high" || priority === "urgent"
                      ? "bg-destructive/15 text-destructive"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {priority}
                </span>
              )}
            </div>

            <div className="my-4 border-t border-border/40" />

            <div className="text-xs sm:text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words font-sans">
              {body}
            </div>

            {click && (
              <div className="mt-6 pt-4 border-t border-border/40">
                <Button asChild size="sm" className="gap-1.5 text-xs">
                  <a href={click} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir enlace
                  </a>
                </Button>
              </div>
            )}
          </div>
        )}
      </Page>
    </AppFrame>
  )
}
