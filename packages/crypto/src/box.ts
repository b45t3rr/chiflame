import { x25519 } from "@noble/curves/ed25519.js"
import { hkdfSha256 } from "./hkdf.js"
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js"
import { bytesToB64url, b64urlToBytes, concat } from "./encoding.js"
import { randomBytes } from "./random.js"

export type X25519Keypair = { publicKey: string; secretKey: string }

export function generateX25519(): X25519Keypair {
  const sk = randomBytes(32)
  const pk = x25519.getPublicKey(sk)
  return { publicKey: bytesToB64url(pk), secretKey: bytesToB64url(sk) }
}

function sealKey(shared: Uint8Array): Uint8Array {
  return hkdfSha256(shared, "chiflame-seal-v1", 32)
}

export function seal(recipientPublicKey: string, plaintext: Uint8Array): string {
  const ephSk = randomBytes(32)
  const ephPk = x25519.getPublicKey(ephSk)
  const shared = x25519.getSharedSecret(ephSk, b64urlToBytes(recipientPublicKey))
  const key = sealKey(shared)
  const nonce = randomBytes(24)
  const ct = xchacha20poly1305(key, nonce).encrypt(plaintext)
  return bytesToB64url(concat(ephPk, nonce, ct))
}

export function open(secretKey: string, sealed: string): Uint8Array {
  const raw = b64urlToBytes(sealed)
  if (raw.length < 32 + 24 + 16) throw new Error("bad_sealed_box")
  const ephPk = raw.subarray(0, 32)
  const nonce = raw.subarray(32, 56)
  const ct = raw.subarray(56)
  const shared = x25519.getSharedSecret(b64urlToBytes(secretKey), ephPk)
  const key = sealKey(shared)
  return xchacha20poly1305(key, nonce).decrypt(ct)
}

export function fingerprintPublicKey(publicKey: string): string {
  const bytes = b64urlToBytes(publicKey)
  return Array.from(bytes.subarray(0, 4), (b) => b.toString(16).padStart(2, "0")).join("")
}
