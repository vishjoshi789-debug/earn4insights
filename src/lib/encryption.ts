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
