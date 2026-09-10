import { describe, expect, it } from "vitest"
import {
  authHashFromMaster,
  decryptMessage,
  deriveMasterKey,
  encryptMessage,
  fingerprintPublicKey,
  generateEd25519,
  generateX25519,
  looksLikePlaintextJson,
  messageAad,
  newChannelDataKey,
  newKdfParams,
  open,
  pairingPopMessage,
  seal,
  signBytes,
  unwrapSecret,
  verifyBytes,
  wrapSecret,
} from "../src/index.js"

describe("kdf + wrap", () => {
  it("derives a master key and wraps a user key", () => {
    const kdf = newKdfParams()
    const master = deriveMasterKey("correct horse battery staple!!", kdf)
    expect(master.length).toBe(32)
    const userKey = newChannelDataKey()
    const wrapped = wrapSecret(master, userKey)
    expect(unwrapSecret(master, wrapped)).toEqual(userKey)
    const auth = authHashFromMaster(master)
    expect(auth).toMatch(/^[0-9a-f]{64}$/)
    expect(auth).not.toContain("horse")
  })
})

describe("sealed box", () => {
  it("seals to an x25519 public key", () => {
    const kp = generateX25519()
    const cdk = newChannelDataKey()
    const sealed = seal(kp.publicKey, cdk)
    expect(open(kp.secretKey, sealed)).toEqual(cdk)
  })
})

describe("messages", () => {
  it("roundtrips and is not plaintext on the wire", () => {
    const cdk = newChannelDataKey()
    const id = "11111111-1111-1111-1111-111111111111"
    const ch = "22222222-2222-2222-2222-222222222222"
    const dev = "33333333-3333-3333-3333-333333333333"
    const aad = messageAad(id, ch, dev)
    const enc = encryptMessage(cdk, { title: "Deploy", body: "prod OK" }, aad)
    expect(enc.alg).toBe("xchacha20poly1305")
    expect(looksLikePlaintextJson(enc.ciphertext)).toBe(false)
    const pt = decryptMessage(cdk, enc, aad)
    expect(pt.title).toBe("Deploy")
    expect(pt.body).toBe("prod OK")
    expect(() => decryptMessage(cdk, enc, messageAad("nope", ch, dev))).toThrow()
  })
})

describe("pairing pop", () => {
  it("signs and verifies pairing_id||nonce", () => {
    const kp = generateEd25519()
    const nonce = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    const msg = pairingPopMessage("pair-id", nonce)
    const sig = signBytes(kp.secretKey, msg)
    expect(verifyBytes(kp.publicKey, msg, sig)).toBe(true)
    expect(verifyBytes(kp.publicKey, msg, signBytes(generateEd25519().secretKey, msg))).toBe(false)
    expect(fingerprintPublicKey(generateX25519().publicKey)).toMatch(/^[0-9a-f]{8}$/)
  })
})
