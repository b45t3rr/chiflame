import { xchacha20poly1305 } from "@noble/ciphers/chacha.js"
import { bytesToB64url, b64urlToBytes, utf8 } from "./encoding.js"
import { randomBytes } from "./random.js"

export function wrapSecret(key: Uint8Array, plaintext: Uint8Array): string {
  const nonce = randomBytes(24)
  const ct = xchacha20poly1305(key, nonce).encrypt(plaintext)
  return `v1.${bytesToB64url(nonce)}.${bytesToB64url(ct)}`
}

export function unwrapSecret(key: Uint8Array, packed: string): Uint8Array {
  const [v, n, c] = packed.split(".")
  if (v !== "v1" || !n || !c) throw new Error("bad_wrapped_secret")
  return xchacha20poly1305(key, b64urlToBytes(n)).decrypt(b64urlToBytes(c))
}

export function wrapUtf8(key: Uint8Array, text: string): string {
  return wrapSecret(key, utf8(text))
}
