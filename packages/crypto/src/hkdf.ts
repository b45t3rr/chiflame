import { hkdf } from "@noble/hashes/hkdf.js"
import { sha256 } from "@noble/hashes/sha2.js"
import { utf8 } from "./encoding.js"

export function hkdfSha256(ikm: Uint8Array, info: string, length: number): Uint8Array {
  return hkdf(sha256, ikm, undefined, utf8(info), length)
}

export function authHashFromMaster(master: Uint8Array): string {
  const raw = hkdfSha256(master, "chiflame-auth-v1", 32)
  return Array.from(raw, (b) => b.toString(16).padStart(2, "0")).join("")
}
