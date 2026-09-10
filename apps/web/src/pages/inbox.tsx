import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { Check, ChevronDown, Copy, Plus, Radio, RefreshCw, Search, Settings2, Star, Trash2, X } from "lucide-react"
import { AnimatePresence, motion, useMotionValue, useTransform } from "motion/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Mark } from "@/components/mark"
import { AppFrame, Page } from "@/components/page"
import { MessageListSkeleton } from "@/components/skeleton"
import { isIos, isStandalone, pushSupported } from "@/lib/platform"
import { supabase } from "@/lib/supabase"
import { relativeTime } from "@/lib/time"
import { ensurePush, osNotificationPermission, pushFailureCopy, startEnablePush, warmServiceWorker } from "@/lib/push"
import { decryptRow, type Channel } from "@/lib/vault"
import { loadLocal, saveFavoriteChannels } from "@/lib/idb"
import { useSession } from "@/state/session"

type Row = {
  id: string
  channel_id: string
  sender_device_id: string
  ciphertext: string
  nonce: string
  alg: string
  priority: string
  created_at: string
  expires_at: string | null
  title: string
  body: string
  unread: boolean
  decryptFail: boolean
}

export function InboxPage() {
  const { slug: slugParam } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { vault, banners, dismissBanner } = useSession()
  const slug = slugParam ?? "inbox"
  const channel = vault?.channels.find((c) => c.slug === slug)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sheet, setSheet] = useState(false)
  const [channelQuery, setChannelQuery] = useState("")
  const [quickOpen, setQuickOpen] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [unreadByChannel, setUnreadByChannel] = useState<Record<string, number>>({})
  const [perm, setPerm] = useState(osNotificationPermission())
  const [snippetTab, setSnippetTab] = useState<"basic" | "urgent" | "link" | "script">("basic")
  const [copiedSnippet, setCopiedSnippet] = useState(false)

  useEffect(() => {
    void loadLocal().then((local) => setFavoriteIds(local.favoriteChannels))
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setQuickOpen(true)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const load = useCallback(async () => {
    if (!vault || !channel) return
    setLoading(true)
    setLoadError(null)
    try {
      const { data: msgs, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", channel.id)
        .order("created_at", { ascending: false })
        .limit(100)
      if (messagesError) throw messagesError

      const { data: ackRows, error: acksError } = await supabase.from("message_acks").select("*").eq("user_id", vault.userId)
      if (acksError) throw acksError
      const map: Record<string, { read_at: string | null; deleted_at: string | null }> = {}
      for (const a of ackRows ?? []) map[a.message_id] = { read_at: a.read_at, deleted_at: a.deleted_at }
      const next: Row[] = []
      for (const m of msgs ?? []) {
        if (map[m.id]?.deleted_at) continue
        if (m.expires_at && Date.parse(m.expires_at) < Date.now()) continue
        const pt = decryptRow(vault, m)
        next.push({
          ...m,
          title: pt?.title || pt?.body?.slice(0, 40) || "No se pudo descifrar",
          body: pt?.body ?? "Volvé a vincular la CLI o abrí el mensaje de nuevo",
          unread: !map[m.id]?.read_at,
          decryptFail: !pt,
        })
      }
      setRows(next)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "No se pudieron cargar los mensajes")
    } finally {
      setLoading(false)
    }
  }, [vault, channel])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!vault) return
    void (async () => {
      const [{ data: messages }, { data: acks }] = await Promise.all([
        supabase.from("messages").select("id, channel_id, expires_at"),
        supabase.from("message_acks").select("message_id, read_at, deleted_at").eq("user_id", vault.userId),
      ])
      const ackMap = new Map((acks ?? []).map((ack) => [ack.message_id, ack]))
      const counts: Record<string, number> = {}
      for (const message of messages ?? []) {
        const ack = ackMap.get(message.id)
        if (!ack?.read_at && !ack?.deleted_at && (!message.expires_at || Date.parse(message.expires_at) >= Date.now())) {
          counts[message.channel_id] = (counts[message.channel_id] ?? 0) + 1
        }
      }
      setUnreadByChannel(counts)
    })()
  }, [vault, rows])

  useEffect(() => {
    if (!params.get("paired")) return
    toast.success("CLI vinculada")
    dismissBanner("paired-flash")
    nav("/inbox", { replace: true })
  }, [params, dismissBanner, nav])

  useEffect(() => {
    void warmServiceWorker()
    if (!vault) return
    void ensurePush(vault.deviceId)
  }, [vault])

  useEffect(() => {
    if (!vault) return
    let ch: ReturnType<typeof supabase.channel> | null = null
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session?.access_token) await supabase.realtime.setAuth(data.session.access_token)
      ch = supabase
        .channel(`chifla:user:${vault.userId}`, { config: { private: true } })
        .on("broadcast", { event: "message" }, () => {
          void load()
        })
        .subscribe()
    })()
    return () => {
      if (ch) void supabase.removeChannel(ch)
    }
  }, [vault, load])

  async function remove(id: string) {
    if (!vault) return
    setRows((r) => r.filter((x) => x.id !== id))
    const { error } = await supabase.from("message_acks").upsert({ message_id: id, user_id: vault.userId, deleted_at: new Date().toISOString() })
    if (error) {
      toast.error("No se pudo borrar el mensaje")
      void load()
      return
    }
    toast("Borrado.", {
      action: {
        label: "Deshacer",
        onClick: () => {
          void supabase.from("message_acks").upsert({ message_id: id, user_id: vault.userId, deleted_at: null }).then(({ error: undoError }) => {
            if (undoError) {
              toast.error("No se pudo deshacer el borrado")
              return
            }
            void load()
          })
        },
      },
      duration: 5000,
    })
  }

  useEffect(() => {
    if (vault && slugParam && !channel) nav("/inbox", { replace: true })
  }, [vault, slugParam, channel, nav])

  if (!vault || !channel) return null

  const filteredChannels = useMemo(() => {
    const query = channelQuery.trim().toLowerCase()
    return vault.channels.filter((candidate) => !query || candidate.name.toLowerCase().includes(query) || candidate.slug.toLowerCase().includes(query))
  }, [channelQuery, vault.channels])
  const favorites = filteredChannels.filter((candidate) => favoriteIds.includes(candidate.id))
  const regularChannels = filteredChannels.filter((candidate) => !favoriteIds.includes(candidate.id) && candidate.kind !== "inbox" && !candidate.muted)
  const mutedChannels = filteredChannels.filter((candidate) => !favoriteIds.includes(candidate.id) && candidate.kind !== "inbox" && candidate.muted)
  const inboxChannel = filteredChannels.find((candidate) => candidate.kind === "inbox")

  function toggleFavorite(id: string) {
    const next = favoriteIds.includes(id) ? favoriteIds.filter((favoriteId) => favoriteId !== id) : [...favoriteIds, id]
    setFavoriteIds(next)
    void saveFavoriteChannels(next)
  }

  const snippetExamples: Record<"basic" | "urgent" | "link" | "script", { label: string; cmd: string; desc: string }> = useMemo(() => ({
    basic: {
      label: "Básico",
      cmd: slug === "inbox" ? 'chifla "Hola desde la terminal"' : `chifla -c ${slug} "Hola desde la terminal"`,
      desc: "Envío instantáneo con prioridad normal",
    },
    urgent: {
      label: "Urgente",
      cmd: slug === "inbox" ? 'chifla -p high "Servidor caído en prod"' : `chifla -c ${slug} -p high "Servidor caído"`,
      desc: "Emite sonido y alerta de alta prioridad",
    },
    link: {
      label: "Con Link",
      cmd: slug === "inbox" ? 'chifla --click https://github.com "PR listo para merge"' : `chifla -c ${slug} --click https://github.com "PR listo"`,
      desc: "Abre la URL de destino al hacer click en la notificación",
    },
    script: {
      label: "En Script",
      cmd: slug === "inbox" ? 'npm test && chifla "Tests OK" || chifla -p high "Tests fallaron"' : `npm run build && chifla -c ${slug} "Build OK"`,
      desc: "Ideal para avisarte cuando terminan scripts o builds lentos",
    },
  }), [slug])

  async function copyCurrentSnippet() {
    const command = snippetExamples[snippetTab].cmd
    await navigator.clipboard.writeText(command)
    setCopiedSnippet(true)
    toast.success("Comando copiado")
    setTimeout(() => setCopiedSnippet(false), 2000)
  }

  const showInstall = !isStandalone() && !banners.includes("install")
  const showPush =
    pushSupported() && perm !== "granted" && perm !== "unsupported" && !banners.includes("push") && !(isIos() && !isStandalone())
  const iosPush = isIos() && !isStandalone() && !banners.includes("install")

  return (
    <AppFrame>
      <Page className="inbox-page">
        <aside className="channel-rail" aria-label="Navegación de canales">
          <div className="channel-rail-header">
            <Link to="/inbox" className="flex items-center gap-2 font-medium tracking-tight hover:opacity-80 transition-opacity">
              <Mark className="h-5 w-5" />
              <span className="text-sm font-semibold">chiflame</span>
            </Link>
            <Link to="/settings" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Configuración
            </Link>
          </div>
          <ChannelSection title="Entrada" channels={inboxChannel ? [inboxChannel] : []} activeSlug={slug} unreadByChannel={unreadByChannel} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} onSelect={(nextSlug) => nav(nextSlug === "inbox" ? "/inbox" : `/c/${nextSlug}`)} />
          {favorites.length > 0 && <ChannelSection title="Favoritos" channels={favorites} activeSlug={slug} unreadByChannel={unreadByChannel} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} onSelect={(nextSlug) => nav(`/c/${nextSlug}`)} />}
          <ChannelSection title="Canales" channels={regularChannels} activeSlug={slug} unreadByChannel={unreadByChannel} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} onSelect={(nextSlug) => nav(`/c/${nextSlug}`)} />
          {mutedChannels.length > 0 && <ChannelSection title="Silenciados" channels={mutedChannels} activeSlug={slug} unreadByChannel={unreadByChannel} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} onSelect={(nextSlug) => nav(`/c/${nextSlug}`)} />}
        </aside>

        <main className="inbox-main flex flex-col">
          <header className="flex items-center justify-between border-b border-border/50 px-3 py-2.5 sm:px-4">
            <button
              type="button"
              onClick={() => setSheet(true)}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-muted"
              aria-expanded={sheet}
              aria-label={`Cambiar canal. Canal actual: ${channel.name}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: channel.color ?? "#10b981" }} />
              <span className="font-semibold text-sm tracking-tight text-foreground">{channel.name}</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">#{channel.slug}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-0.5" />
            </button>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setQuickOpen(true)}
                aria-label="Buscar canal (Ctrl+K)"
              >
                <Search className="h-3.5 w-3.5" />
                <kbd className="hidden font-mono text-[10px] text-muted-foreground/80 md:inline-block border border-border/70 rounded px-1">⌘K</kbd>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Actualizar mensajes"
                disabled={loading}
                onClick={() => void load()}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" asChild>
                <Link to="/settings" aria-label="Configuración">
                  <Settings2 className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </header>

          <div className="space-y-2 px-3 pt-3 sm:px-4">
            {(showInstall || iosPush) && (
              <Banner onDismiss={() => dismissBanner("install")}>
                <Link to="/install" className="hover:underline">
                  Instalá la app para recibir notificaciones push
                </Link>
              </Banner>
            )}
            {showPush && (
              <Banner onDismiss={() => dismissBanner("push")}>
                <button
                  type="button"
                  className="hover:underline"
                  onClick={() => {
                    if (!vault) return
                    const run = startEnablePush(vault.deviceId)
                    void run
                      .then((res) => {
                        setPerm(osNotificationPermission())
                        if (res.ok) {
                          dismissBanner("push")
                          toast.success("Notificaciones activadas")
                        } else toast.error(pushFailureCopy(res.reason))
                      })
                      .catch((e) => toast.error(pushFailureCopy(e instanceof Error ? e.message : "error")))
                  }}
                >
                  Activá notificaciones para este dispositivo
                </button>
              </Banner>
            )}
          </div>

          <div className="flex-1 px-0 sm:px-4 sm:pt-3">
            {loading ? (
              <div className="px-4 py-2">
                <MessageListSkeleton />
              </div>
            ) : loadError ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                <p className="text-sm font-medium text-foreground">No pudimos cargar los mensajes.</p>
                <p className="mt-1 text-xs text-muted-foreground">Revisá la conexión e intentá de nuevo.</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => void load()}>
                  Reintentar
                </Button>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-xs">
                  <Radio className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-sm font-semibold tracking-tight text-foreground">
                  Esperando avisos en {channel.name}
                </h2>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                  Enviá un mensaje desde la terminal para que aparezca acá cifrado de punta a punta.
                </p>

                {/* Developer CLI Snippet Showcase */}
                <div className="mt-5 w-full max-w-md rounded-lg border border-border/70 bg-card/60 p-3.5 shadow-sm text-left backdrop-blur-xs">
                  <div className="flex items-center justify-between gap-1 border-b border-border/40 pb-2 mb-2.5">
                    <div className="flex items-center gap-1">
                      {(["basic", "urgent", "link", "script"] as const).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setSnippetTab(tab)}
                          className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                            snippetTab === tab
                              ? "bg-muted text-foreground font-semibold"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                          }`}
                        >
                          {snippetExamples[tab].label}
                        </button>
                      ))}
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground/70 hidden sm:inline">bash / zsh / ps</span>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 border border-border/50">
                    <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground select-all">
                      {snippetExamples[snippetTab].cmd}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label="Copiar comando"
                      onClick={() => void copyCurrentSnippet()}
                    >
                      {copiedSnippet ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground leading-tight">
                    {snippetExamples[snippetTab].desc}
                  </p>
                </div>

                <div className="mt-5 flex gap-2">
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSheet(true)}>
                    Cambiar canal
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs" asChild>
                    <Link to={`/settings/channels/${slug}`}>Configurar canal</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-border/40 border-y border-border/40 sm:border sm:rounded-lg sm:overflow-hidden bg-card/30">
                <AnimatePresence initial={false}>
                  {rows.map((r) => (
                    <SwipeRow key={r.id} onDelete={() => void remove(r.id)}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:bg-muted/40"
                        onClick={() => {
                          void supabase.from("message_acks").upsert({
                            message_id: r.id,
                            user_id: vault.userId,
                            read_at: new Date().toISOString(),
                          })
                          nav(`/c/${slug}/m/${r.id}`)
                        }}
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full transition-all ${
                            r.unread ? "ring-2 ring-accent/30" : "opacity-30 border border-muted-foreground"
                          }`}
                          style={{
                            background: r.unread ? (channel.color ?? "#10b981") : "transparent",
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className={`truncate text-xs sm:text-sm ${r.unread ? "font-semibold text-foreground" : "font-normal text-muted-foreground"}`}>
                              {r.title}
                            </span>
                            <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70">
                              {relativeTime(r.created_at)}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground leading-relaxed">
                            {r.body}
                          </p>
                        </div>
                      </button>
                    </SwipeRow>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>

          <Sheet open={sheet} onOpenChange={setSheet}>
            <SheetContent>
              <SheetTitle className="sr-only">Selector de canales</SheetTitle>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold tracking-tight">Canales</p>
                  <p className="text-xs text-muted-foreground">Elegí qué canal visualizar.</p>
                </div>
                <Button variant="ghost" size="icon" asChild aria-label="Configurar canales">
                  <Link to="/settings/channels"><Settings2 className="h-4 w-4" /></Link>
                </Button>
              </div>
              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  value={channelQuery}
                  onChange={(event) => setChannelQuery(event.target.value)}
                  placeholder="Buscar canal..."
                  aria-label="Buscar canal"
                  className="h-9 w-full rounded-md border border-border bg-background/50 pl-9 pr-3 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="mt-4 max-h-[50vh] space-y-4 overflow-y-auto pr-1">
                {inboxChannel && <ChannelSection title="Entrada" channels={[inboxChannel]} activeSlug={slug} unreadByChannel={unreadByChannel} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} onSelect={(nextSlug) => { setSheet(false); setChannelQuery(""); nav(nextSlug === "inbox" ? "/inbox" : `/c/${nextSlug}`) }} />}
                {favorites.length > 0 && <ChannelSection title="Favoritos" channels={favorites} activeSlug={slug} unreadByChannel={unreadByChannel} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} onSelect={(nextSlug) => { setSheet(false); setChannelQuery(""); nav(`/c/${nextSlug}`) }} />}
                {regularChannels.length > 0 && <ChannelSection title="Canales" channels={regularChannels} activeSlug={slug} unreadByChannel={unreadByChannel} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} onSelect={(nextSlug) => { setSheet(false); setChannelQuery(""); nav(`/c/${nextSlug}`) }} />}
                {mutedChannels.length > 0 && <ChannelSection title="Silenciados" channels={mutedChannels} activeSlug={slug} unreadByChannel={unreadByChannel} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} onSelect={(nextSlug) => { setSheet(false); setChannelQuery(""); nav(`/c/${nextSlug}`) }} />}
                {filteredChannels.length === 0 && (
                  <div className="rounded-md border border-border/50 bg-muted/40 p-4 text-center text-xs">
                    <p className="text-muted-foreground">No encontramos ese canal.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 text-xs gap-1.5 w-full"
                      asChild
                      onClick={() => { setSheet(false); setChannelQuery(""); }}
                    >
                      <Link to={`/settings/channels/new${channelQuery.trim() ? `?name=${encodeURIComponent(channelQuery.trim())}` : ""}`}>
                        <Plus className="h-3.5 w-3.5" />
                        <span>Crear canal {channelQuery.trim() ? `"${channelQuery.trim()}"` : ""}</span>
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Button className="flex-1 text-xs" asChild onClick={() => { setSheet(false); setChannelQuery(""); }}>
                  <Link to="/settings/channels">Administrar canales</Link>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  asChild
                  onClick={() => { setSheet(false); setChannelQuery(""); }}
                  aria-label="Nuevo canal"
                >
                  <Link to={`/settings/channels/new${channelQuery.trim() ? `?name=${encodeURIComponent(channelQuery.trim())}` : ""}`}>
                    <Plus className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
            <DialogContent className="p-3">
              <DialogTitle className="sr-only">Cambiar de canal</DialogTitle>
              <div className="flex items-center gap-2 border-b border-border/60 px-2 pb-2.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  value={channelQuery}
                  onChange={(event) => setChannelQuery(event.target.value)}
                  placeholder="Ir a un canal…"
                  aria-label="Buscar canal"
                  className="min-w-0 flex-1 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground"
                />
                <kbd className="rounded border border-border/70 bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">ESC</kbd>
              </div>
              <div className="max-h-[50vh] overflow-y-auto pt-1 space-y-0.5">
                {filteredChannels.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-muted/60 transition-colors"
                    onClick={() => {
                      setQuickOpen(false)
                      setChannelQuery("")
                      nav(candidate.slug === "inbox" ? "/inbox" : `/c/${candidate.slug}`)
                    }}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: candidate.color ?? "#10b981" }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-foreground">{candidate.name}</span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">#{candidate.slug}</span>
                    </span>
                    {(unreadByChannel[candidate.id] ?? 0) > 0 && (
                      <span className="rounded-full bg-accent/20 px-1.5 py-0.5 font-mono text-[10px] font-medium text-accent">
                        {unreadByChannel[candidate.id]}
                      </span>
                    )}
                  </button>
                ))}
                {filteredChannels.length === 0 && (
                  <div className="p-4 text-center text-xs">
                    <p className="text-muted-foreground">No encontramos ningún canal con ese nombre.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 text-xs gap-1.5"
                      asChild
                      onClick={() => {
                        setQuickOpen(false)
                        setChannelQuery("")
                      }}
                    >
                      <Link to={`/settings/channels/new${channelQuery.trim() ? `?name=${encodeURIComponent(channelQuery.trim())}` : ""}`}>
                        <Plus className="h-3.5 w-3.5" />
                        <span>Crear canal "{channelQuery.trim()}"</span>
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
              <div className="border-t border-border/50 pt-2 px-1 flex items-center justify-between">
                <Link
                  to={`/settings/channels/new${channelQuery.trim() ? `?name=${encodeURIComponent(channelQuery.trim())}` : ""}`}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => {
                    setQuickOpen(false)
                    setChannelQuery("")
                  }}
                >
                  <Plus className="h-3.5 w-3.5 text-accent" />
                  <span>{channelQuery.trim() ? `Crear canal "${channelQuery.trim()}"` : "Crear un nuevo canal..."}</span>
                </Link>
                <kbd className="text-[10px] font-mono text-muted-foreground/60 hidden sm:inline">↵ enter</kbd>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </Page>
    </AppFrame>
  )
}

function Banner({ children, onDismiss }: { children: React.ReactNode; onDismiss: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/70 bg-card/60 px-3 py-2 text-xs text-muted-foreground">
      <span className="truncate pr-2">{children}</span>
      <button
        type="button"
        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        onClick={onDismiss}
        aria-label="Cerrar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function ChannelSection({
  title,
  channels,
  activeSlug,
  unreadByChannel,
  favoriteIds,
  onToggleFavorite,
  onSelect,
}: {
  title: string
  channels: Channel[]
  activeSlug: string
  unreadByChannel: Record<string, number>
  favoriteIds: string[]
  onToggleFavorite: (id: string) => void
  onSelect: (slug: string) => void
}) {
  return (
    <section>
      <p className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="space-y-0.5">
        {channels.map((candidate) => {
          const unread = unreadByChannel[candidate.id] ?? 0
          const active = candidate.slug === activeSlug
          return (
            <div
              key={candidate.id}
              className={`group flex items-center gap-1.5 rounded-md px-2 py-0.5 transition-colors ${
                active ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-xs"
                onClick={() => onSelect(candidate.slug)}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: candidate.color ?? "#10b981" }}
                />
                <span className="truncate">{candidate.name}</span>
                {unread > 0 && (
                  <span className="ml-auto rounded-full bg-accent/20 px-1.5 py-0.2 font-mono text-[10px] font-medium text-accent">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </button>
              {candidate.kind !== "inbox" && (
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground transition-opacity hover:text-foreground"
                  aria-label={favoriteIds.includes(candidate.id) ? `Quitar ${candidate.name} de favoritos` : `Agregar ${candidate.name} a favoritos`}
                  onClick={() => onToggleFavorite(candidate.id)}
                >
                  <Star className={`h-3 w-3 ${favoriteIds.includes(candidate.id) ? "fill-accent text-accent opacity-100" : ""}`} />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function SwipeRow({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const x = useMotionValue(0)
  const opacity = useTransform(x, [0, 70], [0, 1])
  const textScale = useTransform(x, [0, 70], [0.85, 1])

  return (
    <motion.li
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] } }}
      className="relative overflow-hidden"
    >
      <motion.div
        style={{ opacity }}
        className="absolute inset-y-0 left-0 flex w-full items-center bg-destructive px-5 text-xs font-medium text-destructive-foreground"
      >
        <motion.span style={{ scale: textScale }} className="flex items-center gap-1.5">
          <Trash2 className="h-3.5 w-3.5" /> Borrar
        </motion.span>
      </motion.div>
      <motion.div
        style={{ x, touchAction: "pan-y" }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.05, right: 0.7 }}
        onDragEnd={(_e, info) => {
          if (info.offset.x > 80 || info.velocity.x > 350) {
            onDelete()
          }
        }}
        className="relative bg-background"
      >
        {children}
      </motion.div>
    </motion.li>
  )
}


