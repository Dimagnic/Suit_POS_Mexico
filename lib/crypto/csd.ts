import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const b64 = process.env.CSD_ENCRYPTION_KEY
  if (!b64) throw new Error('CSD_ENCRYPTION_KEY no esta configurada')
  const key = Buffer.from(b64, 'base64')
  if (key.length !== 32) throw new Error('CSD_ENCRYPTION_KEY debe ser una clave de 32 bytes en base64')
  return key
}

export function encryptToBase64(plainBase64: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const plainBuffer = Buffer.from(plainBase64, 'base64')
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decryptToBase64(encryptedBase64: string): string {
  const key = getKey()
  const data = Buffer.from(encryptedBase64, 'base64')
  const iv = data.subarray(0, 12)
  const authTag = data.subarray(12, 28)
  const encrypted = data.subarray(28)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('base64')
}

export function encryptText(plainText: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decryptText(encryptedBase64: string): string {
  const key = getKey()
  const data = Buffer.from(encryptedBase64, 'base64')
  const iv = data.subarray(0, 12)
  const authTag = data.subarray(12, 28)
  const encrypted = data.subarray(28)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}