import { bytesToB64url, b64urlToBytes, hkdfSha256, randomBytes } from "@chiflame/crypto"

export type PasskeyMaterial = {
  credId: string
  prfSalt: string
  master: Uint8Array
  usedPrf: boolean
}

type PrfExt = {
  prf?: {
    enabled?: boolean
    results?: { first?: ArrayBuffer }
  }
}

function challenge(): BufferSource {
  return randomBytes(32) as BufferSource
}

function rpId(): string {
  return window.location.hostname
}

export function passkeysSupported(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential
}

export async function createDevicePasskey(): Promise<PasskeyMaterial> {
  if (!passkeysSupported()) throw new Error("Este dispositivo no soporta passkeys")
  const salt = randomBytes(32) as Uint8Array
  const userId = randomBytes(16) as BufferSource
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: challenge(),
      rp: { name: "Chiflame", id: rpId() },
      user: {
        id: userId,
        name: "chiflame",
        displayName: "Chiflame",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      timeout: 120_000,
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "required",
      },
      attestation: "none",
      extensions: { prf: { eval: { first: salt as BufferSource } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null
  if (!cred) throw new Error("No se creó la passkey")
  const ext = cred.getClientExtensionResults() as PrfExt
  const prf = ext.prf?.results?.first
  const master = prf ? hkdfSha256(new Uint8Array(prf), "chiflame-prf-v1", 32) : randomBytes(32)
  return {
    credId: bytesToB64url(new Uint8Array(cred.rawId)),
    prfSalt: bytesToB64url(salt),
    master,
    usedPrf: Boolean(prf),
  }
}

export async function assertDevicePasskey(opts: { credId: string; prfSalt: string }): Promise<Uint8Array> {
  if (!passkeysSupported()) throw new Error("Este dispositivo no soporta passkeys")
  const salt = b64urlToBytes(opts.prfSalt)
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: challenge(),
      rpId: rpId(),
      timeout: 120_000,
      userVerification: "required",
      allowCredentials: [
        { type: "public-key", id: b64urlToBytes(opts.credId) as BufferSource },
      ],
      extensions: { prf: { eval: { first: salt as BufferSource } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null
  if (!cred) throw new Error("Cancelado")
  const ext = cred.getClientExtensionResults() as PrfExt
  const prf = ext.prf?.results?.first
  if (prf) return hkdfSha256(new Uint8Array(prf), "chiflame-prf-v1", 32)
  throw new Error("PRF_MISSING")
}
