import { useState } from "react"
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  EyeOff,
  Fingerprint,
  Github,
  Key,
  Layers,
  Lock,
  Play,
  QrCode,
  Shield,
  ShieldCheck,
  Smartphone,
  Terminal,
  Zap,
} from "lucide-react"
import { DotPattern } from "@/components/magicui/dot-pattern"
import { BorderBeam } from "@/components/magicui/border-beam"
import { Marquee } from "@/components/magicui/marquee"
import { BlurFade } from "@/components/magicui/blur-fade"
import { Mark } from "@/components/mark"

export function App() {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"run" | "wait" | "send" | "pipe">("run")

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCmd(id)
    setTimeout(() => setCopiedCmd(null), 2000)
  }

  const tabs = {
    run: {
      title: "chifla run",
      badge: "Automático",
      desc: "Ejecuta cualquier comando, mide el tiempo y te avisa cuando termina o si falló.",
      cmd: "chifla run -t 'Build de Producción' npm run build",
      output: [
        "$ chifla run -t 'Build de Producción' npm run build",
        "> vite build",
        "✓ 1671 modules transformed.",
        "dist/index.html   1.10 kB",
        "✓ built in 1.33s",
        "sent 769d8d57... → inbox [0 errors · 1.33s]",
      ],
      notif: {
        title: "Build de Producción",
        body: "Comando 'npm run build' finalizado exitosamente (exit 0) en 1.33s.",
        time: "ahora",
        channel: "inbox",
        status: "exit 0",
      },
    },
    wait: {
      title: "chifla wait",
      badge: "No invasivo",
      desc: "¿Ya lanzaste un proceso pesado? Vigila su PID sin detenerlo ni reiniciarlo.",
      cmd: "chifla wait 14280 -t 'Entrenamiento Modelo'",
      output: [
        "$ chifla wait 14280 -t 'Entrenamiento Modelo'",
        "chifla: monitoreando proceso python (PID 14280)...",
        "esperando término de proceso...",
        "chifla: proceso 14280 completado tras 24m 12s.",
        "sent a42f428c... → inbox",
      ],
      notif: {
        title: "Proceso Finalizado: python",
        body: "PID 14280 terminó con éxito tras 24m 12s de cómputo ininterrumpido.",
        time: "ahora",
        channel: "inbox",
        status: "success",
      },
    },
    send: {
      title: "chifla send",
      badge: "Instantáneo",
      desc: "Envía alertas puntuales con canal y nivel de prioridad desde CI o scripts.",
      cmd: "chifla -c deploys -p urgent 'Deploy canary completado en edge'",
      output: [
        "$ chifla -c deploys -p urgent 'Deploy canary completado en edge'",
        "encrypting payload with XChaCha20-Poly1305...",
        "signing request with device Ed25519 key...",
        "sent bd319bb7... → #deploys (urgent)",
      ],
      notif: {
        title: "Deploy canary completado en edge",
        body: "Tráfico al 100% en 310 PoPs de Cloudflare sin anomalías reportadas.",
        time: "ahora",
        channel: "deploys",
        status: "urgent",
      },
    },
    pipe: {
      title: "Pipes / Stdin",
      badge: "Unix Pipes",
      desc: "Redirige salidas estándar o logs de error directamente a tu teléfono.",
      cmd: "git log -1 --oneline | chifla -t 'Nuevo Release'",
      output: [
        "$ git log -1 --oneline | chifla -t 'Nuevo Release'",
        "reading stdin stream (1 line)...",
        "52958a9 feat: open source initial release of chiflame",
        "sent 62a7cbbe... → inbox",
      ],
      notif: {
        title: "Nuevo Release",
        body: "52958a9 feat: open source initial release of chiflame (E2EE notification system)",
        time: "ahora",
        channel: "inbox",
        status: "git",
      },
    },
  }

  const techBadges = [
    { name: "XChaCha20-Poly1305 AEAD", tag: "Cifrado Simétrico" },
    { name: "X25519 Key Exchange", tag: "Curve25519" },
    { name: "Ed25519 Proof-of-Possession", tag: "Firmas de Hardware" },
    { name: "WebAuthn & Passkeys", tag: "Biometría Segura" },
    { name: "Zero-Knowledge Storage", tag: "Sin Texto en Claro" },
    { name: "Web Push Opaco", tag: "Sin Fuga a Apple/Google" },
    { name: "Cloudflare Edge", tag: "Global Latency <50ms" },
    { name: "100% Open Source MIT", tag: "Código Auditable" },
  ]

  return (
    <div className="relative min-h-screen bg-black text-[#ededed] font-sans antialiased selection:bg-[#00e68a]/20 selection:text-[#00e68a]">
      {/* Background DotPattern from Magic UI */}
      <DotPattern
        className="opacity-40 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_25%,#000_60%,transparent_100%)] fill-zinc-700"
        width={24}
        height={24}
        cr={1.2}
      />

      {/* Top Banner: Open Source Announcement */}
      <div className="relative z-20 border-b border-white/[0.08] bg-black/60 backdrop-blur-md px-4 py-2 text-center text-xs text-zinc-400">
        <span className="inline-flex items-center gap-1.5 font-mono text-[#00e68a] font-medium mr-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00e68a] animate-pulse" />
          v0.1.0 Open Source
        </span>
        Todo el código es auditable y público bajo licencia MIT.{" "}
        <a
          href="https://github.com/b45t3rr/chiflame"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-white hover:text-[#00e68a] underline underline-offset-4 transition-colors font-medium ml-1"
        >
          Explorar repositorio <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-black/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2.5 group">
            <Mark className="h-7 w-7 transition-transform group-hover:scale-105" />
            <span className="font-semibold tracking-tight text-white text-base">chiflame</span>
          </a>

          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-zinc-400">
            <a href="#como-funciona" className="hover:text-white transition-colors">
              Cómo funciona
            </a>
            <a href="#auditoria" className="hover:text-white transition-colors">
              Criptografía E2EE
            </a>
            <a href="#transparencia" className="hover:text-white transition-colors">
              Zero-Knowledge
            </a>
            <a href="#cli" className="hover:text-white transition-colors">
              CLI
            </a>
            <a
              href="https://github.com/b45t3rr/chiflame"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="https://app.chifla.me"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium bg-white text-black hover:bg-zinc-200 active:scale-[0.98] transition-all"
            >
              Abrir App
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-24 px-6 overflow-hidden">
        <div className="max-w-4xl mx-auto text-center">
          <BlurFade delay={0.1}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.04] text-xs font-mono text-zinc-300 mb-8 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00e68a]" />
              <span>Zero-Knowledge &middot; End-to-End Encrypted</span>
            </div>
          </BlurFade>

          <BlurFade delay={0.2}>
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white leading-[1.05]">
              Notificaciones de tu terminal a tu bolsillo.
            </h1>
          </BlurFade>

          <BlurFade delay={0.3}>
            <p className="mt-6 text-base sm:text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto font-normal leading-relaxed">
              Lanza builds, deploys o entrenamientos de IA y recibe una notificación en tu teléfono al terminar. Cifrado de extremo a extremo: <span className="text-white font-medium">el servidor nunca tiene tus claves ni puede leer tus mensajes</span>.
            </p>
          </BlurFade>

          {/* CTAs */}
          <BlurFade delay={0.4}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <a
                href="https://app.chifla.me"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md text-sm font-medium bg-white text-black hover:bg-zinc-200 active:scale-[0.98] transition-all shadow-sm"
              >
                Probar en app.chifla.me
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="https://github.com/b45t3rr/chiflame"
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md text-sm font-medium border border-white/10 bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-200 hover:border-white/20 transition-all"
              >
                <Github className="h-4 w-4" />
                Ver código en GitHub
              </a>
            </div>

            {/* Quick Install Bar */}
            <div className="mt-8 flex items-center justify-center">
              <div className="inline-flex items-center gap-3 rounded-md border border-white/10 bg-zinc-950/80 px-4 py-2 font-mono text-xs text-zinc-300 shadow-inner backdrop-blur-sm">
                <span className="text-[#00e68a] select-none">$</span>
                <span className="font-mono">npm i -g chiflame && chifla auth pair</span>
                <button
                  onClick={() => copyToClipboard("npm i -g chiflame && chifla auth pair", "hero-cmd")}
                  className="text-zinc-500 hover:text-white transition-colors ml-1 p-0.5 rounded"
                  title="Copiar comando"
                  aria-label="Copiar comando"
                >
                  {copiedCmd === "hero-cmd" ? (
                    <Check className="h-3.5 w-3.5 text-[#00e68a]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </BlurFade>
        </div>

        {/* Interactive Showcase Card with BorderBeam from Magic UI */}
        <BlurFade delay={0.5}>
          <div className="max-w-5xl mx-auto mt-16 sm:mt-20">
            <div className="relative rounded-xl border border-white/10 bg-zinc-950 shadow-2xl overflow-hidden">
              {/* BorderBeam highlight */}
              <BorderBeam size={280} duration={12} anchor={90} borderWidth={1.5} colorFrom="#00e68a" colorTo="#3b82f6" />

              {/* Terminal Window Chrome */}
              <div className="px-4 py-3 border-b border-white/[0.08] bg-zinc-900/50 backdrop-blur-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-zinc-800 inline-block border border-white/5" />
                  <span className="h-3 w-3 rounded-full bg-zinc-800 inline-block border border-white/5" />
                  <span className="h-3 w-3 rounded-full bg-zinc-800 inline-block border border-white/5" />
                  <span className="ml-2 font-mono text-[11px] text-zinc-500">cli &middot; pwa live demo</span>
                </div>

                {/* Subcommands Tabs */}
                <div className="flex items-center gap-1 bg-black/50 p-0.5 rounded-lg border border-white/[0.06]">
                  {(["run", "wait", "send", "pipe"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1 rounded text-xs font-mono transition-all ${
                        activeTab === tab
                          ? "bg-zinc-800 text-white font-medium shadow-xs"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {tabs[tab].title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Showcase Grid: Terminal Left, PWA Notification Right */}
              <div className="grid grid-cols-1 lg:grid-cols-12">
                {/* Terminal Pane */}
                <div className="lg:col-span-7 p-6 font-mono text-xs flex flex-col justify-between bg-black/40">
                  <div>
                    <div className="flex items-center justify-between text-zinc-500 mb-3 text-[11px]">
                      <span>{tabs[activeTab].desc}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/[0.05] border border-white/5 text-zinc-400">
                        {tabs[activeTab].badge}
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-zinc-900/70 px-3 py-2.5 rounded-md border border-white/10 text-white mb-4">
                      <span className="truncate pr-2 font-mono">{tabs[activeTab].cmd}</span>
                      <button
                        onClick={() => copyToClipboard(tabs[activeTab].cmd, `tab-${activeTab}`)}
                        className="text-zinc-500 hover:text-white transition-colors shrink-0"
                        title="Copiar comando"
                      >
                        {copiedCmd === `tab-${activeTab}` ? (
                          <Check className="h-3.5 w-3.5 text-[#00e68a]" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="space-y-1.5 text-zinc-400 font-mono text-xs">
                      {tabs[activeTab].output.map((line, idx) => (
                        <div
                          key={idx}
                          className={
                            line.startsWith("sent")
                              ? "text-[#00e68a] font-medium pt-2"
                              : line.startsWith("$")
                              ? "text-white font-medium"
                              : line.startsWith(">") || line.startsWith("✓")
                              ? "text-zinc-300"
                              : "text-zinc-500"
                          }
                        >
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-[11px] text-zinc-500 pt-5 mt-6 flex items-center gap-2 border-t border-white/[0.06]">
                    <Lock className="h-3.5 w-3.5 text-[#00e68a]" />
                    <span>Payload cifrado con clave local simétrica antes del socket o HTTP push</span>
                  </div>
                </div>

                {/* Receiver Pane (PWA Replica) */}
                <div className="lg:col-span-5 p-6 border-t lg:border-t-0 lg:border-l border-white/[0.08] bg-zinc-950 flex flex-col justify-center">
                  <div className="text-[11px] font-mono text-zinc-500 mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Smartphone className="h-3.5 w-3.5 text-[#00e68a]" />
                      <span>app.chifla.me</span>
                    </span>
                    <span className="text-[10px] text-zinc-600 font-mono">PWA &middot; Web Push</span>
                  </div>

                  {/* Simulated Mobile Notification Card matching app.chifla.me */}
                  <div className="rounded-xl border border-white/10 bg-zinc-900/90 p-4 shadow-xl relative backdrop-blur-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-black border border-white/10 flex items-center justify-center text-white shrink-0">
                          <Mark className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white">Chiflame</span>
                            <span className="text-[10px] font-mono text-zinc-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                              #{tabs[activeTab].notif.channel}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono">{tabs[activeTab].notif.time}</span>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#00e68a]/10 text-[#00e68a] border border-[#00e68a]/20">
                        {tabs[activeTab].notif.status}
                      </span>
                    </div>

                    <div className="mt-3.5">
                      <h4 className="text-sm font-semibold text-zinc-100 tracking-tight">
                        {tabs[activeTab].notif.title}
                      </h4>
                      <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                        {tabs[activeTab].notif.body}
                      </p>
                    </div>

                    <div className="mt-3.5 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
                      <span className="text-[#00e68a] font-mono text-[10px] inline-flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Descifrado con hardware passkey
                      </span>
                      <a
                        href="https://app.chifla.me"
                        className="text-zinc-400 hover:text-white transition-colors text-[10px] underline underline-offset-2"
                      >
                        Abrir buzón &rarr;
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </BlurFade>
      </section>

      {/* Marquee with Cryptographic Stack & Guarantees from Magic UI */}
      <section className="border-y border-white/[0.08] bg-zinc-950/60 py-4 overflow-hidden">
        <Marquee pauseOnHover repeat={4} className="[--duration:35s]">
          {techBadges.map((badge, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2.5 mx-4 px-3.5 py-1.5 rounded-full border border-white/10 bg-zinc-900/80 text-xs font-mono text-zinc-300"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#00e68a]" />
              <span className="font-semibold text-white">{badge.name}</span>
              <span className="text-zinc-500 text-[11px]">&middot; {badge.tag}</span>
            </div>
          ))}
        </Marquee>
      </section>

      {/* Cryptography Architecture / Audit Section */}
      <section id="auditoria" className="py-24 border-b border-white/[0.08] bg-black">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl">
            <span className="font-mono text-xs uppercase tracking-wider text-[#00e68a] font-medium">
              Criptografía Auditable
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Cero conocimiento. Sin secretos en el servidor.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-zinc-400 leading-relaxed">
              La mayoría de los sistemas de alertas guardan tus textos en bases de datos relacionales o los transmiten en claro a brokers intermediarios. En Chiflame, la base de datos solo almacena blobs ininteligibles de alta entropía.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Box 1 */}
            <div className="rounded-xl border border-white/10 bg-zinc-950 p-6 flex flex-col justify-between hover:border-white/20 transition-all">
              <div>
                <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-[#00e68a] mb-4">
                  <Shield className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">XChaCha20-Poly1305</h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Cifrado autenticado simétrico con nonce de 192 bits. Vincula criptográficamente el ID del mensaje y canal como Associated Data (AAD) para prevenir ataques de replay.
                </p>
              </div>
              <a
                href="https://github.com/b45t3rr/chiflame/blob/main/packages/crypto/src/symmetric.ts"
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-1 text-xs font-mono text-[#00e68a] hover:underline"
              >
                symmetric.ts <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Box 2 */}
            <div className="rounded-xl border border-white/10 bg-zinc-950 p-6 flex flex-col justify-between hover:border-white/20 transition-all">
              <div>
                <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-[#00e68a] mb-4">
                  <Key className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">X25519 Sealed Box</h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Intercambio de claves efímeras para emparejar nuevos dispositivos. Las Channel Data Keys (CDK) viajan cifradas asimétricamente y nunca tocan el servidor en claro.
                </p>
              </div>
              <a
                href="https://github.com/b45t3rr/chiflame/blob/main/packages/crypto/src/asymmetric.ts"
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-1 text-xs font-mono text-[#00e68a] hover:underline"
              >
                asymmetric.ts <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Box 3 */}
            <div className="rounded-xl border border-white/10 bg-zinc-950 p-6 flex flex-col justify-between hover:border-white/20 transition-all">
              <div>
                <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-[#00e68a] mb-4">
                  <Fingerprint className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">Passkeys &amp; WebAuthn</h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Sin contraseñas vulnerables a phishing. El Secure Enclave o TPM de tu dispositivo custodia tu clave del Vault, desbloqueada exclusivamente mediante biometría.
                </p>
              </div>
              <a
                href="https://github.com/b45t3rr/chiflame/blob/main/apps/web/src/lib/vault.ts"
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-1 text-xs font-mono text-[#00e68a] hover:underline"
              >
                vault.ts <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Box 4 */}
            <div className="rounded-xl border border-white/10 bg-zinc-950 p-6 flex flex-col justify-between hover:border-white/20 transition-all">
              <div>
                <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-[#00e68a] mb-4">
                  <EyeOff className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">Push Opaco</h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Los gateways de Apple (APNs) y Google (FCM) nunca leen tus mensajes. Solo envían una señal de despertar; tu Service Worker descarga el blob y lo descifra en local.
                </p>
              </div>
              <a
                href="https://github.com/b45t3rr/chiflame/blob/main/supabase/functions/dispatch-push/index.ts"
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-1 text-xs font-mono text-[#00e68a] hover:underline"
              >
                dispatch-push <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Data Transparency Matrix */}
      <section id="transparencia" className="py-24 border-b border-white/[0.08] bg-zinc-950">
        <div className="max-w-5xl mx-auto px-6">
          <div className="max-w-2xl">
            <span className="font-mono text-xs uppercase tracking-wider text-[#00e68a] font-medium">
              Matriz de Transparencia
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-white">
              ¿Qué ve el servidor vs. tu dispositivo?
            </h2>
            <p className="mt-3 text-sm text-zinc-400">
              Chiflame está diseñado bajo el principio de mínimo privilegio y conocimiento nulo.
            </p>
          </div>

          <div className="mt-10 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-zinc-400 font-mono">
                  <th className="py-3 px-4">Dato o Componente</th>
                  <th className="py-3 px-4">Tu Máquina / CLI</th>
                  <th className="py-3 px-4">Servidor Supabase / Edge</th>
                  <th className="py-3 px-4">Tu Teléfono (PWA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-zinc-300">
                <tr>
                  <td className="py-3.5 px-4 font-medium text-white">Comando y duración</td>
                  <td className="py-3.5 px-4 text-[#00e68a] font-mono">Visible localmente</td>
                  <td className="py-3.5 px-4 text-zinc-500 font-mono">Nunca enviado</td>
                  <td className="py-3.5 px-4 text-[#00e68a] font-mono">Descifrado en RAM</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-medium text-white">Texto de la notificación</td>
                  <td className="py-3.5 px-4 text-[#00e68a] font-mono">Texto plano temporal</td>
                  <td className="py-3.5 px-4 text-zinc-500 font-mono">Ciphertext opaco (0 texto)</td>
                  <td className="py-3.5 px-4 text-[#00e68a] font-mono">Descifrado con CDK</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-medium text-white">Claves criptográficas</td>
                  <td className="py-3.5 px-4 text-zinc-300 font-mono">~/.chifla/config.json</td>
                  <td className="py-3.5 px-4 text-zinc-500 font-mono">0 claves almacenadas</td>
                  <td className="py-3.5 px-4 text-zinc-300 font-mono">Vault con Passkey</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-medium text-white">Notificación Push (Apple/Google)</td>
                  <td className="py-3.5 px-4 text-zinc-500 font-mono">No interactúa</td>
                  <td className="py-3.5 px-4 text-zinc-500 font-mono">Payload de despertar vacío</td>
                  <td className="py-3.5 px-4 text-[#00e68a] font-mono">Despierta SW y descarga</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* How it Works: 3 Steps */}
      <section id="como-funciona" className="py-24 border-b border-white/[0.08] bg-black">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto">
            <span className="font-mono text-xs uppercase tracking-wider text-[#00e68a] font-medium">
              Flujo de Configuración
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Listo en 60 segundos.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-zinc-400">
              Sin crear contraseñas largas, sin tarjetas de crédito y sin intermediarios.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="rounded-xl border border-white/10 bg-zinc-950 p-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-3xl font-bold text-white">01</span>
                  <Smartphone className="h-5 w-5 text-zinc-500" />
                </div>
                <h3 className="mt-6 text-base font-semibold text-white">Abre la PWA en tu teléfono</h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Ingresa a{" "}
                  <a href="https://app.chifla.me" className="text-[#00e68a] underline underline-offset-4 font-medium">
                    app.chifla.me
                  </a>{" "}
                  e instálala con 1 toque en tu pantalla de inicio. Crea tu buzón con tu Passkey biométrica.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/[0.06] text-[11px] font-mono text-zinc-500">
                Soporte iOS 16.4+ y Android
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl border border-white/10 bg-zinc-950 p-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-3xl font-bold text-white">02</span>
                  <QrCode className="h-5 w-5 text-zinc-500" />
                </div>
                <h3 className="mt-6 text-base font-semibold text-white">Empareja tu CLI con un QR</h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Instala el CLI con <code className="text-white bg-zinc-900 px-1.5 py-0.5 rounded font-mono">npm i -g chiflame</code> y ejecuta <code className="text-white bg-zinc-900 px-1.5 py-0.5 rounded font-mono">chifla auth pair</code>. Escanea el código con tu celular.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/[0.06] text-[11px] font-mono text-zinc-500">
                Intercambio X25519 cifrado
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-xl border border-white/10 bg-zinc-950 p-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-3xl font-bold text-white">03</span>
                  <Play className="h-5 w-5 text-zinc-500" />
                </div>
                <h3 className="mt-6 text-base font-semibold text-white">Chifla cuando termine</h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Envuelve comandos largos con <code className="text-white bg-zinc-900 px-1.5 py-0.5 rounded font-mono">chifla run</code> o vigila procesos en ejecución con <code className="text-white bg-zinc-900 px-1.5 py-0.5 rounded font-mono">chifla wait &lt;PID&gt;</code>.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/[0.06] text-[11px] font-mono text-zinc-500">
                Alerta inmediata con sonido y vibración
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CLI Capabilities Grid */}
      <section id="cli" className="py-24 border-b border-white/[0.08] bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl">
            <span className="font-mono text-xs uppercase tracking-wider text-[#00e68a] font-medium">
              Diseñado para Desarrolladores
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Herramientas de terminal que se adaptan a tu workflow.
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl border border-white/10 bg-black">
              <Terminal className="h-5 w-5 text-[#00e68a] mb-3" />
              <h3 className="text-sm font-semibold text-white">chifla run &lt;comando&gt;</h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                Mide duración exacta, código de salida y estado. Si falla, incluye un resumen del error para que sepas qué pasó antes de volver a tu escritorio.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-white/10 bg-black">
              <Zap className="h-5 w-5 text-[#00e68a] mb-3" />
              <h3 className="text-sm font-semibold text-white">chifla wait &lt;PID&gt;</h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                ¿Olvidaste anteponer el comando? Ancla un watcher a cualquier PID activo en macOS, Linux o Windows con consumo mínimo de CPU.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-white/10 bg-black">
              <Layers className="h-5 w-5 text-[#00e68a] mb-3" />
              <h3 className="text-sm font-semibold text-white">Canales y Prioridades</h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                Dirige alertas a canales temáticos (<code className="font-mono text-[11px] text-zinc-200">#deploys</code>, <code className="font-mono text-[11px] text-zinc-200">#backups</code>, <code className="font-mono text-[11px] text-zinc-200">#models</code>) con flags de prioridad.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-white/10 bg-black">
              <ShieldCheck className="h-5 w-5 text-[#00e68a] mb-3" />
              <h3 className="text-sm font-semibold text-white">Proof-of-Possession Ed25519</h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                Cada petición de revocación o emisión de notificaciones se autentica criptográficamente en el cliente antes de tocar la red.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-white/10 bg-black">
              <Smartphone className="h-5 w-5 text-[#00e68a] mb-3" />
              <h3 className="text-sm font-semibold text-white">PWA sin Stores</h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                Sin descargas pesadas desde App Store o Google Play. Abre app.chifla.me en Safari o Chrome y agrégala a la pantalla de inicio.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-white/10 bg-black">
              <Github className="h-5 w-5 text-[#00e68a] mb-3" />
              <h3 className="text-sm font-semibold text-white">100% Auto-hosteable</h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                Puedes alojar tu propia instancia en Cloudflare Pages y Supabase con las migraciones SQL y Edge Functions incluidas en el repositorio.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="py-24 border-b border-white/[0.08] bg-black relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
            Deja de esperar frente a la consola.
          </h2>
          <p className="mt-4 text-base text-zinc-400 max-w-xl mx-auto">
            Configura tu buzón seguro en menos de un minuto y recibe alertas cifradas en cualquier lugar.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <a
              href="https://app.chifla.me"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md text-sm font-medium bg-white text-black hover:bg-zinc-200 active:scale-[0.98] transition-all shadow-sm"
            >
              Comenzar en app.chifla.me
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="https://github.com/b45t3rr/chiflame"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md text-sm font-medium border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition-all"
            >
              <Github className="h-4 w-4" />
              Ver código en GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-12 px-6 text-xs text-zinc-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Mark className="h-5 w-5" />
            <span className="font-semibold text-zinc-300">Chiflame</span>
            <span>&middot;</span>
            <span>Zero-Knowledge E2EE notifications for developers</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="https://app.chifla.me" className="hover:text-white transition-colors">
              PWA
            </a>
            <a
              href="https://github.com/b45t3rr/chiflame"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://github.com/b45t3rr/chiflame/blob/main/LICENSE"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              Licencia MIT
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
