import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

// AES-256-GCM parameters
const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16 // 128 bits for GCM
const AUTH_TAG_LENGTH = 16 // 128 bits
const SALT_LENGTH = 32

/**
 * Get encryption key from environment variable
 * Falls back to a default key in development (NEVER use in production)
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY
  
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY environment variable is required in production')
    }
    
    // Development fallback (INSECURE - for testing only)
    console.warn('⚠️  WARNING: Using default encryption key. Set ENCRYPTION_KEY in production!')
    return 'dev-key-32-chars-minimum-length-required-for-aes256'
  }
  
  if (key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long')
  }
  
  return key
}

/**
 * Derive a cryptographic key from the password using scrypt
 */
async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
}

/**
 * Encrypt sensitive data using AES-256-GCM
 * 
 * @param plaintext - Data to encrypt (will be JSON stringified)
 * @returns Encrypted data as base64 string: salt:iv:authTag:ciphertext
 */
export async function encrypt(plaintext: any): Promise<string> {
  try {
    // Convert to JSON string
    const text = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext)
    
    // Generate random salt and IV
    const salt = randomBytes(SALT_LENGTH)
    const iv = randomBytes(IV_LENGTH)
    
    // Derive key from password
    const password = getEncryptionKey()
    const key = await deriveKey(password, salt)
    
    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, iv)
    
    // Encrypt data
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final()
    ])
    
    // Get authentication tag
    const authTag = cipher.getAuthTag()
    
    // Combine salt:iv:authTag:encrypted and encode as base64
    const combined = Buffer.concat([salt, iv, authTag, encrypted])
    return combined.toString('base64')
    
  } catch (error) {
    console.error('[Encryption] Error encrypting data:', error)
    throw new Error('Failed to encrypt sensitive data')
  }
}

/**
 * Decrypt sensitive data using AES-256-GCM
 * 
 * @param encryptedData - Encrypted data as base64 string: salt:iv:authTag:ciphertext
 * @returns Decrypted data (parsed as JSON if possible)
 */
export async function decrypt(encryptedData: string): Promise<any> {
  try {
    // Decode from base64
    const combined = Buffer.from(encryptedData, 'base64')
    
    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH)
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    )
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH)
    
    // Derive key from password
    const password = getEncryptionKey()
    const key = await deriveKey(password, salt)
    
    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    
    // Decrypt data
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ])
    
    const text = decrypted.toString('utf8')
    
    // Try to parse as JSON
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
    
  } catch (error) {
    console.error('[Encryption] Error decrypting data:', error)
    throw new Error('Failed to decrypt sensitive data - data may be corrupted or key is incorrect')
  }
}

/**
 * Check if data appears to be encrypted
 */
export function isEncrypted(data: any): boolean {
  if (typeof data !== 'string') {
    return false
  }
  
  // Encrypted data should be base64 and have minimum length
  // salt(32) + iv(16) + authTag(16) + encrypted(min 1) = 65 bytes minimum
  // Base64 encoding: 65 bytes * 4/3 ≈ 87 chars minimum
  if (data.length < 87) {
    return false
  }
  
  // Check if it's valid base64
  const base64Regex = /^[A-Za-z0-9+/]+=*$/
  return base64Regex.test(data)
}

/**
 * Encrypt sensitive user data (income, age, location)
 */
export async function encryptSensitiveData(data: {
  income?: string
  age?: number
  location?: string
}): Promise<string> {
  return encrypt(data)
}

/**
 * Decrypt sensitive user data
 */
export async function decryptSensitiveData(encryptedData: string): Promise<{
  income?: string
  age?: number
  location?: string
} | null> {
  try {
    return await decrypt(encryptedData)
  } catch (error) {
    console.error('[Encryption] Failed to decrypt sensitive data:', error)
    return null
  }
}

/**
 * Generate a secure encryption key (for setup)
 * Run this once and store in environment variable
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('base64')
}

// Export for testing
export const __test__ = {
  deriveKey,
  ALGORITHM,
  KEY_LENGTH,
  IV_LENGTH,
  AUTH_TAG_LENGTH,
  SALT_LENGTH
}

// ════════════════════════════════════════════════════════════════
// VERSIONED KEY SYSTEM
// For special-category sensitive data (GDPR Art. 9) that requires
// independent key rotation without re-encrypting all other data.
//
// Environment variables:
//   CURRENT_ENCRYPTION_KEY_ID   — e.g. "v1" (which key is active)
//   ENCRYPTION_KEY_v1           — key material for version v1
//   ENCRYPTION_KEY_v2           — key material for version v2
//   (falls back to ENCRYPTION_KEY if versioned key is not set)
//
// Key rotation procedure:
//   1. Generate a new key:  generateEncryptionKey()
//   2. Add ENCRYPTION_KEY_v2=<new key> to environment
//   3. Set CURRENT_ENCRYPTION_KEY_ID=v2
//   4. Run re-encryption job: reEncryptWithNewKey() on each stored row
//   5. Remove ENCRYPTION_KEY_v1 after all rows are migrated
// ════════════════════════════════════════════════════════════════

/**
 * Get the current active key ID from environment.
 * Defaults to 'v1' if not configured.
 */
export function getCurrentKeyId(): string {
  return process.env.CURRENT_ENCRYPTION_KEY_ID ?? 'v1'
}

/**
 * Get the raw key material for a given key ID.
 * Looks for ENCRYPTION_KEY_<keyId> first, then falls back to ENCRYPTION_KEY.
 */
function getKeyMaterialForId(keyId: string): string {
  const versionedKey = process.env[`ENCRYPTION_KEY_${keyId}`]
  if (versionedKey) {
    if (versionedKey.length < 32) {
      throw new Error(`ENCRYPTION_KEY_${keyId} must be at least 32 characters long`)
    }
    return versionedKey
  }

  // Fall back to the base ENCRYPTION_KEY (backward compat for keyId='v1')
  const baseKey = process.env.ENCRYPTION_KEY
  if (!baseKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `No encryption key found for keyId="${keyId}". ` +
        `Set ENCRYPTION_KEY_${keyId} or ENCRYPTION_KEY in environment.`
      )
    }
    console.warn(`⚠️  WARNING: Using default encryption key for keyId="${keyId}". Set ENCRYPTION_KEY_${keyId} in production!`)
    return 'dev-key-32-chars-minimum-length-required-for-aes256'
  }

  if (baseKey.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long')
  }
  return baseKey
}

/**
 * Encrypt data using a specific key version.
 * Returns the encrypted base64 string (same format as encrypt()).
 */
async function encryptWithKeyId(plaintext: any, keyId: string): Promise<string> {
  const text = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext)
  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)
  const password = getKeyMaterialForId(keyId)
  const key = await deriveKey(password, salt)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  const combined = Buffer.concat([salt, iv, authTag, encrypted])
  return combined.toString('base64')
}

/**
 * Decrypt data using a specific key version.
 */
async function decryptWithKeyId(encryptedData: string, keyId: string): Promise<any> {
  const combined = Buffer.from(encryptedData, 'base64')
  const salt = combined.subarray(0, SALT_LENGTH)
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH)
  const password = getKeyMaterialForId(keyId)
  const key = await deriveKey(password, salt)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  const text = decrypted.toString('utf8')
  try { return JSON.parse(text) } catch { return text }
}

/**
 * Encrypt data for database storage using the current active key.
 * Returns both the encrypted value and the key ID used — store both in the DB row.
 *
 * Usage:
 *   const { encryptedValue, encryptionKeyId } = await encryptForStorage(data)
 *   // save both columns to DB
 */
export async function encryptForStorage(
  data: any
): Promise<{ encryptedValue: string; encryptionKeyId: string }> {
  const encryptionKeyId = getCurrentKeyId()
  const encryptedValue = await encryptWithKeyId(data, encryptionKeyId)
  return { encryptedValue, encryptionKeyId }
}

/**
 * Decrypt data retrieved from the database.
 * Requires the key ID that was stored alongside the encrypted value.
 *
 * Usage:
 *   const plaintext = await decryptFromStorage(row.encryptedValue, row.encryptionKeyId)
 */
export async function decryptFromStorage(
  encryptedValue: string,
  encryptionKeyId: string
): Promise<any> {
  return decryptWithKeyId(encryptedValue, encryptionKeyId)
}

/**
 * Re-encrypt a stored value using a new key ID.
 * Use this during key rotation to migrate rows without downtime.
 *
 * Algorithm:
 *   1. Decrypt with oldKeyId
 *   2. Re-encrypt with newKeyId
 *   3. Return new encrypted value + new key ID — UPDATE the DB row
 *
 * Usage:
 *   for each row with encryptionKeyId = oldKeyId:
 *     const rotated = await reEncryptWithNewKey(row.encryptedValue, row.encryptionKeyId, 'v2')
 *     await db.update(...).set(rotated).where(...)
 */
export async function reEncryptWithNewKey(
  encryptedValue: string,
  oldKeyId: string,
  newKeyId: string
): Promise<{ encryptedValue: string; encryptionKeyId: string }> {
  if (oldKeyId === newKeyId) {
    throw new Error('reEncryptWithNewKey: oldKeyId and newKeyId must be different')
  }
  const plaintext = await decryptWithKeyId(encryptedValue, oldKeyId)
  const newEncryptedValue = await encryptWithKeyId(plaintext, newKeyId)
  return { encryptedValue: newEncryptedValue, encryptionKeyId: newKeyId }
}
