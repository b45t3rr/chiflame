export { bytesToB64url, b64urlToBytes, utf8, utf8decode, concat, timingSafeEqual } from "./encoding.js"
export { randomBytes } from "./random.js"
export { KDF_V1, newKdfParams, deriveMasterKey, type KdfParams } from "./kdf.js"
export { hkdfSha256, authHashFromMaster } from "./hkdf.js"
export { wrapSecret, unwrapSecret, wrapUtf8 } from "./secret.js"
export { generateX25519, seal, open, fingerprintPublicKey, type X25519Keypair } from "./box.js"
export {
  generateEd25519,
  signBytes,
  verifyBytes,
  pairingPopMessage,
  newNonce32,
  type Ed25519Keypair,
} from "./sign.js"
export {
  MESSAGE_ALG,
  messageAad,
  encryptMessage,
  decryptMessage,
  looksLikePlaintextJson,
  type MessagePlaintext,
  type EncryptedMessage,
} from "./message.js"
import { randomBytes } from "./random.js"

export function newChannelDataKey(): Uint8Array {
  return randomBytes(32)
}
