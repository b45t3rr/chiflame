import { get, set, del, delMany } from "idb-keyval"

export type StoredProfile = {
  id: string
  kdf: unknown
  wrapped_user_key: string
  public_key: string
  wrapped_private_key: string
}

export type ThemePref = "system" | "light" | "dark"

const K = {
  profile: "profile",
  deviceId: "deviceId",
  deviceKey: "deviceKey",
  wrappedCdks: "wrappedCdks",
  channelIndex: "channelIndex",
  preview: "previewOn",
  banners: "dismissedBanners",
  theme: "theme",
  accessToken: "accessToken",
  pmUsername: "pmUsername",
  passkeyCredId: "passkeyCredId",
  prfSalt: "prfSalt",
  localMaster: "localMaster",
  favoriteChannels: "favoriteChannels",
} as const

export async function loadLocal() {
  const [profile, deviceId, deviceKey, wrappedCdks, channelIndex, previewOn, banners, theme, pmUsername, passkeyCredId, prfSalt, localMaster, favoriteChannels] =
    await Promise.all([
      get<StoredProfile>(K.profile),
      get<string>(K.deviceId),
      get<string>(K.deviceKey),
      get<Record<string, string>>(K.wrappedCdks),
      get<Record<string, { slug: string; color: string | null }>>(K.channelIndex),
      get<boolean>(K.preview),
      get<string[]>(K.banners),
      get<ThemePref>(K.theme),
      get<string>(K.pmUsername),
      get<string>(K.passkeyCredId),
      get<string>(K.prfSalt),
      get<string>(K.localMaster),
      get<string[]>(K.favoriteChannels),
    ])
  return {
    profile: profile ?? null,
    deviceId: deviceId ?? null,
    deviceKey: deviceKey ?? null,
    wrappedCdks: wrappedCdks ?? {},
    channelIndex: channelIndex ?? {},
    previewOn: previewOn !== false,
    banners: banners ?? [],
    theme: theme ?? "system",
    pmUsername: pmUsername ?? "chiflame",
    passkeyCredId: passkeyCredId ?? null,
    prfSalt: prfSalt ?? null,
    localMaster: localMaster ?? null,
    favoriteChannels: favoriteChannels ?? [],
  }
}

export async function saveProfile(p: StoredProfile) {
  await set(K.profile, p)
}
export async function saveDevice(id: string, key: string) {
  await set(K.deviceId, id)
  await set(K.deviceKey, key)
}
export async function saveWrappedCdks(m: Record<string, string>) {
  await set(K.wrappedCdks, m)
}
export async function saveChannelIndex(m: Record<string, { slug: string; color: string | null }>) {
  await set(K.channelIndex, m)
}
export async function savePreview(on: boolean) {
  await set(K.preview, on)
}
export async function saveBanners(ids: string[]) {
  await set(K.banners, ids)
}
export async function saveTheme(t: ThemePref) {
  await set(K.theme, t)
}
export async function saveAccessToken(token: string) {
  await set(K.accessToken, token)
}
export async function saveRefreshToken(token: string) {
  await set("refreshToken", token)
}
export async function saveSessionTokens(access: string, refresh?: string | null) {
  await set(K.accessToken, access)
  if (refresh) await set("refreshToken", refresh)
}
export async function savePmUsername(username: string) {
  await set(K.pmUsername, username)
}
export async function savePasskeyMeta(credId: string, prfSalt: string, localMaster?: string) {
  await set(K.passkeyCredId, credId)
  await set(K.prfSalt, prfSalt)
  if (localMaster) await set(K.localMaster, localMaster)
  else await del(K.localMaster)
}
export async function saveFavoriteChannels(ids: string[]) {
  await set(K.favoriteChannels, ids)
}

export async function clearLocal() {
  await delMany(Object.values(K))
  await del("supabase.auth.token")
}
