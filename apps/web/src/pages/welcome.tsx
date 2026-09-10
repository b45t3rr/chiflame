import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { GateFrame, Page } from "@/components/page"
import { Mark } from "@/components/mark"

export function WelcomePage() {
  return (
    <GateFrame>
      <Page className="flex flex-1 flex-col justify-between py-8">
        <div className="flex flex-1 flex-col items-center justify-center text-center px-4">
          <div className="relative mb-6">
            <Mark className="h-12 w-12" />
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            <span>Notificaciones E2EE</span>
          </div>
          <h1 className="mt-4 text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            chiflame
          </h1>
          <p className="mt-2.5 max-w-xs text-xs sm:text-sm leading-relaxed text-muted-foreground">
            Avisos cifrados directo a tu dispositivo desde scripts, bots y terminales con un solo comando.
          </p>
        </div>

        <div className="flex flex-col gap-3 px-4">
          <Button asChild size="default" className="h-10 w-full text-xs font-semibold">
            <Link to="/onboarding">Comenzar configuración</Link>
          </Button>
          <p className="text-center font-mono text-[11px] text-muted-foreground/70">
            La clave criptográfica nunca sale de tu hardware
          </p>
        </div>
      </Page>
    </GateFrame>
  )
}
