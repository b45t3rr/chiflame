import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { applyTheme } from "@/lib/platform"
import { clearLocal, loadLocal, saveBanners, savePreview, saveSessionTokens, saveTheme, type ThemePref } from "@/lib/idb"
import { supabase } from "@/lib/supabase"
import { unlockVault, unlockWithPasskey, type UnlockedVault } from "@/lib/vault"

export type Gate = "loading" | "guest" | "locked" | "unlocked"

type Ctx = {
  gate: Gate
  vault: UnlockedVault | null
  theme: ThemePref
  previewOn: boolean
  banners: string[]
  setTheme: (t: ThemePref) => void
  setPreview: (on: boolean) => void
  dismissBanner: (id: string) => void
  setVault: (v: UnlockedVault) => void
  unlock: (passphrase: string) => Promise<void>
  unlockPasskey: () => Promise<void>
  lock: () => void
  signOutLocal: () => Promise<void>
}

const C = createContext<Ctx | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<Gate>("loading")
  const [vault, setVaultState] = useState<UnlockedVault | null>(null)
  const [theme, setThemeState] = useState<ThemePref>("system")
  const [previewOn, setPreviewState] = useState(true)
  const [banners, setBanners] = useState<string[]>([])

  useEffect(() => {
    void (async () => {
      const local = await loadLocal()
      setThemeState(local.theme)
      setPreviewState(local.previewOn)
      setBanners(local.banners)
      applyTheme(local.theme)
      const { data } = await supabase.auth.getSession()
      if (data.session || local.profile) setGate("locked")
      else setGate("guest")
    })()
  }, [])

  useEffect(() => {
    applyTheme(theme)
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const on = () => theme === "system" && applyTheme("system")
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [theme])

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void saveSessionTokens(session.access_token, session.refresh_token)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const setTheme = (t: ThemePref) => {
    setThemeState(t)
    void saveTheme(t)
    applyTheme(t)
  }
  const setPreview = (on: boolean) => {
    setPreviewState(on)
    void savePreview(on)
  }
  const dismissBanner = useCallback((id: string) => {
    setBanners((b) => {
      if (b.includes(id)) return b
      const next = [...b, id]
      void saveBanners(next)
      return next
    })
  }, [])
  const setVault = (v: UnlockedVault) => {
    setVaultState(v)
    setGate("unlocked")
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void saveSessionTokens(data.session.access_token, data.session.refresh_token)
    })
  }
  const unlock = async (passphrase: string) => {
    const v = await unlockVault(passphrase)
    setVaultState(v)
    setGate("unlocked")
    const { data } = await supabase.auth.getSession()
    if (data.session) await saveSessionTokens(data.session.access_token, data.session.refresh_token)
  }
  const unlockPasskey = async () => {
    const v = await unlockWithPasskey()
    setVaultState(v)
    setGate("unlocked")
    const { data } = await supabase.auth.getSession()
    if (data.session) await saveSessionTokens(data.session.access_token, data.session.refresh_token)
  }
  const lock = () => {
    setVaultState(null)
    setGate("locked")
  }
  const signOutLocal = async () => {
    await supabase.auth.signOut()
    await clearLocal()
    setVaultState(null)
    setGate("guest")
  }

  const value = useMemo<Ctx>(
    () => ({
      gate,
      vault,
      theme,
      previewOn,
      banners,
      setTheme,
      setPreview,
      dismissBanner,
      setVault,
      unlock,
      unlockPasskey,
      lock,
      signOutLocal,
    }),
    [gate, vault, theme, previewOn, banners, dismissBanner],
  )

  return <C.Provider value={value}>{children}</C.Provider>
}

export function useSession() {
  const v = useContext(C)
  if (!v) throw new Error("useSession")
  return v
}
