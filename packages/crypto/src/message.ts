import { xchacha20poly1305 } from "@noble/ciphers/chacha.js"
import { bytesToB64url, b64urlToBytes, utf8, utf8decode } from "./encoding.js"
import { randomBytes } from "./random.js"

export const MESSAGE_ALG = "xchacha20poly1305" as const

export type MessagePlaintext = {
  title?: string
  body: string
  tags?: string[]
  click?: string
  actions?: { id: string; title: string }[]
  icon?: string
}

export type EncryptedMessage = {
  alg: typeof MESSAGE_ALG
  nonce: string
  ciphertext: string
}

export function messageAad(messageId: string, channelId: string, senderDeviceId: string): string {
  return `${messageId}|${channelId}|${senderDeviceId}`
}

export function encryptMessage(
  cdk: Uint8Array,
  plaintext: MessagePlaintext,
  aad: string,
): EncryptedMessage {
  const n = randomBytes(24)
  const pt = utf8(JSON.stringify(plaintext))
  const ct = xchacha20poly1305(cdk, n, utf8(aad)).encrypt(pt)
  return { alg: MESSAGE_ALG, nonce: bytesToB64url(n), ciphertext: bytesToB64url(ct) }
}

export function decryptMessage(
  cdk: Uint8Array,
  enc: EncryptedMessage,
  aad: string,
): MessagePlaintext {
  const pt = xchacha20poly1305(cdk, b64urlToBytes(enc.nonce), utf8(aad)).decrypt(
    b64urlToBytes(enc.ciphertext),
  )
  return JSON.parse(utf8decode(pt)) as MessagePlaintext
}

export function looksLikePlaintextJson(ciphertext: string): boolean {
  try {
    const s = utf8decode(b64urlToBytes(ciphertext))
    const j = JSON.parse(s) as { title?: unknown; body?: unknown }
    return typeof j.title === "string" || typeof j.body === "string"
  } catch {
    return false
  }
}
