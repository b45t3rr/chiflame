import {
  authHashFromMaster,
  bytesToB64url,
  b64urlToBytes,
  deriveMasterKey,
  decryptMessage,
  fingerprintPublicKey,
  generateX25519,
  messageAad,
  newChannelDataKey,
  newKdfParams,
  open,
  seal,
  unwrapSecret,
  wrapSecret,
  type KdfParams,
  type MessagePlaintext,
} from "@chiflame/crypto"
import { callFn, supabase } from "./supabase"
import { loadLocal, saveChannelIndex, saveDevice, savePasskeyMeta, savePmUsername, saveProfile, saveWrappedCdks, takeLegacyLocalMaster, type StoredProfile } from "./idb"
import { assertDevicePasskey, createDevicePasskey } from "./webauthn"

export type Channel = {
  id: string
  slug: string
  name: string
  kind: string
  color: string | null
  icon: string | null
  muted: boolean
  retention_days: number
}

export type UnlockedVault = {
  userId: string
  userKey: Uint8Array
  x25519Sk: string
  x25519Pk: string
  deviceId: string
  deviceKey: Uint8Array
  cdks: Record<string, Uint8Array>
  channels: Channel[]
}

const COLORS = ["#d95f59", "#e18a3b", "#c6a83c", "#3f8f68", "#2796a5", "#4f78b8", "#8667ad", "#c45b88"]
const COLOR_NAMES = ["Coral", "Naranja", "Amarillo", "Verde", "Turquesa", "Azul", "Violeta", "Rosa"]

export function channelColors(): string[] {
  return COLORS
}

export function channelColorName(color: string): string {
  return COLOR_NAMES[COLORS.indexOf(color)] ?? "Personalizado"
}

export async function createVaultFromMaster(
  master: Uint8Array,
  kdf: Record<string, unknown>,
  authEmail: string,
): Promise<UnlockedVault> {
  const userKey = newChannelDataKey()
  const box = generateX25519()
  const cdk = newChannelDataKey()
  const deviceKey = newChannelDataKey()
  const password = authHashFromMaster(master)

  const provisioned = await callFn<{ user_id?: string; error?: { message: string } }>("provision-user", {
    email: authEmail,
    password,
  })
  if (provisioned.status >= 400 || !provisioned.data.user_id) {
    throw new Error(provisioned.data.error?.message ?? "No se pudo crear la cuenta")
  }
  const { data: signed, error } = await supabase.auth.signInWithPassword({ email: authEmail, password })
  if (error || !signed.user) throw new Error(error?.message ?? "No se pudo iniciar sesión")
  const userId = signed.user.id

  const profile: StoredProfile = {
    id: userId,
    kdf,
    wrapped_user_key: wrapSecret(master, userKey),
    public_key: box.publicKey,
    wrapped_private_key: wrapSecret(userKey, b64urlToBytes(box.secretKey)),
  }

  const { error: pErr } = await supabase.from("profiles").insert(profile)
  if (pErr) throw new Error(pErr.message)
  await savePmUsername(authEmail)

  const { data: channel, error: cErr } = await supabase
    .from("channels")
    .insert({ owner_id: userId, slug: "inbox", name: "Inbox", kind: "inbox", color: COLORS[0] })
    .select("*")
    .single()
  if (cErr || !channel) throw new Error(cErr?.message ?? "inbox")

  const { error: mErr } = await supabase.from("channel_members").insert({
    channel_id: channel.id,
    user_id: userId,
    role: "owner",
    wrapped_channel_key: seal(box.publicKey, cdk),
  })
  if (mErr) throw new Error(mErr.message)

  const { data: device, error: dErr } = await supabase
    .from("devices")
    .insert({ user_id: userId, kind: "pwa", name: deviceName(), public_key: box.publicKey })
    .select("id")
    .single()
  if (dErr || !device) throw new Error(dErr?.message ?? "device")

  await persistUnlocked(profile, device.id, deviceKey, { [channel.id]: cdk }, [
    {
      id: channel.id,
      slug: channel.slug,
      name: channel.name,
      kind: channel.kind,
      color: channel.color,
      icon: channel.icon,
      muted: false,
      retention_days: channel.retention_days,
    },
  ])

  return {
    userId,
    userKey,
    x25519Sk: box.secretKey,
    x25519Pk: box.publicKey,
    deviceId: device.id,
    deviceKey,
    cdks: { [channel.id]: cdk },
    channels: [
      {
        id: channel.id,
        slug: "inbox",
        name: "Inbox",
        kind: "inbox",
        color: COLORS[0],
        icon: null,
        muted: false,
        retention_days: 30,
      },
    ],
  }
}

export async function createVault(passphrase: string, email?: string): Promise<UnlockedVault> {
  const kdf = newKdfParams()
  const master = deriveMasterKey(passphrase, kdf)
  const uid = crypto.randomUUID()
  return createVaultFromMaster(master, kdf, email?.trim() || `u${uid.replace(/-/g, "")}@chiflame.app`)
}

export async function createVaultWithPasskey(): Promise<UnlockedVault> {
  const pk = await createDevicePasskey()
  const uid = crypto.randomUUID()
  const email = `u${uid.replace(/-/g, "")}@chiflame.app`
  const kdf = { alg: "webauthn-prf", version: 1, salt: pk.prfSalt }
  const vault = await createVaultFromMaster(pk.master, kdf, email)
  await savePasskeyMeta(pk.credId, pk.prfSalt)
  return vault
}


export async function rotateDevicePasskey(vault: UnlockedVault): Promise<void> {
  const pk = await createDevicePasskey()
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      kdf: { alg: "webauthn-prf", version: 1, salt: pk.prfSalt },
      wrapped_user_key: wrapSecret(pk.master, vault.userKey),
    })
    .eq("id", vault.userId)
  if (profileError) throw new Error(profileError.message)

  const { error: authError } = await supabase.auth.updateUser({ password: authHashFromMaster(pk.master) })
  if (authError) throw new Error(authError.message)
  await savePasskeyMeta(pk.credId, pk.prfSalt)
}

export async function unlockWithPasskey(): Promise<UnlockedVault> {
  const local = await loadLocal()
  if (!local.passkeyCredId || !local.prfSalt) throw new Error("No hay passkey en este dispositivo")
  const legacyMaster = await takeLegacyLocalMaster()
  const master = legacyMaster
    ? b64urlToBytes(legacyMaster)
    : await assertDevicePasskey({ credId: local.passkeyCredId, prfSalt: local.prfSalt })
  const { error } = await supabase.auth.signInWithPassword({
    email: local.pmUsername,
    password: authHashFromMaster(master),
  })
  if (error && !error.message.toLowerCase().includes("already")) {
    const sess = await supabase.auth.getSession()
    if (!sess.data.session) throw new Error(error.message)
  }
  const vault = await unlockVaultWithMaster(master)
  if (legacyMaster) await rotateDevicePasskey(vault)
  return vault
}

export async function unlockVault(passphrase: string): Promise<UnlockedVault> {
  const { data: sess } = await supabase.auth.getSession()
  const user = sess.session?.user
  if (!user) throw new Error("Sesión ausente")
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  if (error || !profile) throw new Error("Passphrase incorrecta")
  try {
    const master = deriveMasterKey(passphrase, profile.kdf as KdfParams)
    return finishUnlock(user.id, profile as StoredProfile, master)
  } catch {
    throw new Error("Passphrase incorrecta")
  }
}

export async function unlockVaultWithMaster(master: Uint8Array): Promise<UnlockedVault> {
  const { data: sess } = await supabase.auth.getSession()
  const user = sess.session?.user
  if (!user) throw new Error("Sesión ausente")
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  if (error || !profile) throw new Error("No hay vault")
  return finishUnlock(user.id, profile as StoredProfile, master)
}

async function finishUnlock(userId: string, profile: StoredProfile, master: Uint8Array): Promise<UnlockedVault> {
  const userKey = unwrapSecret(master, profile.wrapped_user_key)

  const skBytes = unwrapSecret(userKey, profile.wrapped_private_key)
  const x25519Sk = bytesToB64url(skBytes)

  const { data: members } = await supabase.from("channel_members").select("channel_id, wrapped_channel_key, muted")
  const { data: channels } = await supabase.from("channels").select("*")
  const cdks: Record<string, Uint8Array> = {}
  const list: Channel[] = []
  for (const ch of channels ?? []) {
    const mem = (members ?? []).find((m) => m.channel_id === ch.id)
    if (!mem) continue
    try {
      cdks[ch.id] = open(x25519Sk, mem.wrapped_channel_key)
    } catch {
      /* missing key */
    }
    list.push({
      id: ch.id,
      slug: ch.slug,
      name: ch.name,
      kind: ch.kind,
      color: ch.color,
      icon: ch.icon,
      muted: Boolean(mem.muted),
      retention_days: ch.retention_days,
    })
  }

  let deviceId: string | null = null
  const local = await loadLocal()
  const { data: devices } = await supabase.from("devices").select("id, kind").eq("kind", "pwa").is("revoked_at", null)
  const localDeviceActive = Boolean(local.deviceId && devices?.some((device) => device.id === local.deviceId))
  deviceId = localDeviceActive ? local.deviceId : null
  if (!deviceId) {
    const { data: d } = await supabase
      .from("devices")
      .insert({ user_id: userId, kind: "pwa", name: deviceName() })
      .select("id")
      .single()
    if (!d?.id) throw new Error("No se pudo registrar este dispositivo")
    deviceId = d.id
  }
  const id = deviceId ?? crypto.randomUUID()

  const deviceKey = localDeviceActive && local.deviceKey ? b64urlToBytes(local.deviceKey) : newChannelDataKey()
  await persistUnlocked(profile, id, deviceKey, cdks, list)

  return {
    userId,
    userKey,
    x25519Sk,
    x25519Pk: profile.public_key,
    deviceId: id,
    deviceKey,
    cdks,
    channels: list,
  }
}

async function persistUnlocked(
  profile: StoredProfile,
  deviceId: string,
  deviceKey: Uint8Array,
  cdks: Record<string, Uint8Array>,
  channels: Channel[],
) {
  const wrapped: Record<string, string> = {}
  for (const [id, cdk] of Object.entries(cdks)) wrapped[id] = wrapSecret(deviceKey, cdk)
  await saveProfile(profile)
  await saveDevice(deviceId, bytesToB64url(deviceKey))
  await saveWrappedCdks(wrapped)
  await saveChannelIndex(Object.fromEntries(channels.map((c) => [c.id, { slug: c.slug, color: c.color }])))
}

export function decryptRow(
  vault: UnlockedVault,
  row: { id: string; channel_id: string; sender_device_id: string; ciphertext: string; nonce: string; alg: string },
): MessagePlaintext | null {
  const cdk = vault.cdks[row.channel_id]
  if (!cdk) return null
  try {
    return decryptMessage(cdk, { alg: "xchacha20poly1305", nonce: row.nonce, ciphertext: row.ciphertext }, messageAad(row.id, row.channel_id, row.sender_device_id))
  } catch {
    return null
  }
}

export async function sealChannelsForCli(vault: UnlockedVault, cliPublicKey: string): Promise<string> {
  const payload = JSON.stringify({
    channels: Object.entries(vault.cdks).map(([id, cdk]) => {
      const ch = vault.channels.find((c) => c.id === id)
      return { id, slug: ch?.slug ?? id, cdk: bytesToB64url(cdk) }
    }),
  })
  return seal(cliPublicKey, new TextEncoder().encode(payload))
}

export function fingerprint(pk: string): string {
  return fingerprintPublicKey(pk)
}

export async function createChannel(vault: UnlockedVault, opts: { name: string; slug: string; color: string; icon?: string }) {
  const cdk = newChannelDataKey()
  const { data: ch, error } = await supabase
    .from("channels")
    .insert({
      owner_id: vault.userId,
      slug: opts.slug,
      name: opts.name,
      kind: "personal",
      color: opts.color,
      icon: opts.icon || null,
    })
    .select("*")
    .single()
  if (error || !ch) throw new Error(error?.message ?? "create")
  const { error: memberError } = await supabase.from("channel_members").insert({
    channel_id: ch.id,
    user_id: vault.userId,
    role: "owner",
    wrapped_channel_key: seal(vault.x25519Pk, cdk),
  })
  if (memberError) {
    await supabase.from("channels").delete().eq("id", ch.id)
    throw new Error(memberError.message)
  }
  const { data: clis, error: cliError } = await supabase.from("devices").select("id, public_key").eq("kind", "cli").is("revoked_at", null)
  if (cliError) throw new Error(cliError.message)
  for (const d of clis ?? []) {
    if (!d.public_key) continue
    const { error: keyError } = await supabase.from("device_channel_keys").upsert({
      device_id: d.id,
      channel_id: ch.id,
      wrapped_cdk: seal(d.public_key, cdk),
    })
    if (keyError) {
      await supabase.from("channels").delete().eq("id", ch.id)
      throw new Error(keyError.message)
    }
  }
  vault.cdks[ch.id] = cdk
  vault.channels.push({
    id: ch.id,
    slug: ch.slug,
    name: ch.name,
    kind: ch.kind,
    color: ch.color,
    icon: ch.icon,
    muted: false,
    retention_days: ch.retention_days,
  })
  const wrapped: Record<string, string> = {}
  for (const [id, k] of Object.entries(vault.cdks)) wrapped[id] = wrapSecret(vault.deviceKey, k)
  await saveWrappedCdks(wrapped)
  await saveChannelIndex(Object.fromEntries(vault.channels.map((c) => [c.id, { slug: c.slug, color: c.color }])))
  return ch as Channel
}

function deviceName(): string {
  const ua = navigator.userAgent
  if (/iphone/i.test(ua)) return "iPhone"
  if (/ipad/i.test(ua)) return "iPad"
  if (/android/i.test(ua)) return "Android"
  return "PWA"
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32) || "canal"
}
