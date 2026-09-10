import { ed25519 } from "@noble/curves/ed25519.js"
import { bytesToB64url, b64urlToBytes, concat, utf8 } from "./encoding.js"
import { randomBytes } from "./random.js"

export type Ed25519Keypair = { publicKey: string; secretKey: string }

export function generateEd25519(): Ed25519Keypair {
  const sk = randomBytes(32)
  const pk = ed25519.getPublicKey(sk)
  return { publicKey: bytesToB64url(pk), secretKey: bytesToB64url(sk) }
}

export function signBytes(secretKey: string, message: Uint8Array): string {
  return bytesToB64url(ed25519.sign(message, b64urlToBytes(secretKey)))
}

export function verifyBytes(publicKey: string, message: Uint8Array, signature: string): boolean {
  try {
    return ed25519.verify(b64urlToBytes(signature), message, b64urlToBytes(publicKey))
  } catch {
    return false
  }
}

export function pairingPopMessage(pairingId: string, nonceB64url: string): Uint8Array {
  return concat(utf8(pairingId), b64urlToBytes(nonceB64url))
}

export function newNonce32(): string {
  return bytesToB64url(randomBytes(32))
}
