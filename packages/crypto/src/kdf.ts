import { argon2id } from "@noble/hashes/argon2.js"
import { bytesToB64url, b64urlToBytes, utf8 } from "./encoding.js"
import { randomBytes } from "./random.js"

export const KDF_V1 = {
  alg: "argon2id" as const,
  version: 1,
  t: 3,
  m: 65536,
  p: 1,
  dkLen: 32,
}

export type KdfParams = {
  alg: "argon2id"
  version: number
  t: number
  m: number
  p: number
  dkLen?: number
  salt: string
}

export function newKdfParams(): KdfParams {
  return { ...KDF_V1, salt: bytesToB64url(randomBytes(16)) }
}

export function deriveMasterKey(passphrase: string, kdf: KdfParams): Uint8Array {
  if (kdf.alg !== "argon2id") throw new Error("unsupported_kdf")
  return argon2id(utf8(passphrase), b64urlToBytes(kdf.salt), {
    t: kdf.t,
    m: kdf.m,
    p: kdf.p,
    dkLen: kdf.dkLen ?? 32,
  })
}
