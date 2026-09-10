import { Navigate, Outlet, Route, Routes, useLocation, useParams } from "react-router-dom"
import { AnimatePresence } from "motion/react"
import { Toaster } from "sonner"
import { Mark } from "@/components/mark"
import { useSession } from "@/state/session"
import { WelcomePage } from "@/pages/welcome"
import { OnboardingPage } from "@/pages/onboarding"
import { UnlockPage } from "@/pages/unlock"
import { PairPage } from "@/pages/pair"
import { InstallPage } from "@/pages/install"
import { InboxPage } from "@/pages/inbox"
import { MessagePage } from "@/pages/message"
import { SettingsPage } from "@/pages/settings"
import { SettingsDevicesPage } from "@/pages/settings-devices"
import { SettingsChannelsPage } from "@/pages/settings-channels"
import { SettingsChannelFormPage } from "@/pages/settings-channel-form"
import { SettingsNotificationsPage } from "@/pages/settings-notifications"
import { SettingsSecurityPage } from "@/pages/settings-security"
import { SettingsAppearancePage } from "@/pages/settings-appearance"

function RootRedirect() {
  const { gate } = useSession()
  if (gate === "loading") return <Splash />
  if (gate === "unlocked") return <Navigate to="/inbox" replace />
  if (gate === "locked") return <Navigate to="/unlock" replace />
  return <WelcomePage />
}

function NeedUnlocked() {
  const { gate } = useSession()
  const loc = useLocation()
  if (gate === "loading") return <Splash />
  if (gate === "guest") return <Navigate to="/" replace />
  if (gate === "locked") return <Navigate to={`/unlock?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  return <Outlet />
}

function NeedGuest() {
  const { gate } = useSession()
  if (gate === "loading") return <Splash />
  if (gate === "unlocked") return <Navigate to="/inbox" replace />
  if (gate === "locked") return <Navigate to="/unlock" replace />
  return <Outlet />
}

function InboxAlias() {
  const { messageId } = useParams()
  return <Navigate to={`/c/inbox/m/${messageId}`} replace />
}

function Splash() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <Mark className="h-9 w-9 animate-pulse text-foreground/80" />
    </div>
  )
}

export function App() {
  const loc = useLocation()
  return (
    <>
      <Toaster
        position="bottom-center"
        theme="system"
        richColors={false}
        toastOptions={{
          className: "border border-border/80 bg-card text-foreground font-sans text-xs shadow-xl rounded-md",
        }}
      />
      <AnimatePresence mode="wait">
        <Routes location={loc} key={loc.pathname}>
          <Route path="/" element={<RootRedirect />} />
          <Route element={<NeedGuest />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Route>
          <Route path="/unlock" element={<UnlockPage />} />
          <Route path="/pair/:id" element={<PairPage />} />
          <Route path="/install" element={<InstallPage />} />
          <Route element={<NeedUnlocked />}>
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/inbox/m/:messageId" element={<InboxAlias />} />
            <Route path="/c/:slug" element={<InboxPage />} />
            <Route path="/c/:slug/m/:messageId" element={<MessagePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/devices" element={<SettingsDevicesPage />} />
            <Route path="/settings/channels" element={<SettingsChannelsPage />} />
            <Route path="/settings/channels/new" element={<SettingsChannelFormPage />} />
            <Route path="/settings/channels/:slug" element={<SettingsChannelFormPage />} />
            <Route path="/settings/notifications" element={<SettingsNotificationsPage />} />
            <Route path="/settings/security" element={<SettingsSecurityPage />} />
            <Route path="/settings/appearance" element={<SettingsAppearancePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </>
  )
}
