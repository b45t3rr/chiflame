import { ed25519 } from "npm:@noble/curves@1.9.7/ed25519.js"
import { b64urlToBytes, concat } from "./b64.ts"

export function verifyPairingPop(opts: {
  signPublicKey: string
  pairingId: string
  nonce: string
  signature: string
}): boolean {
  const msg = concat(new TextEncoder().encode(opts.pairingId), b64urlToBytes(opts.nonce))
  try {
    return ed25519.verify(b64urlToBytes(opts.signature), msg, b64urlToBytes(opts.signPublicKey))
  } catch {
    return false
  }
}
