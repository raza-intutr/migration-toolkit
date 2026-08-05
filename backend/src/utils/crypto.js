import { createDecipheriv, createHash } from 'crypto';

// Encryption key from multitenancy.encryption-key (same default as Java app).
const ENCRYPTION_KEY = process.env.MULTITENANCY_ENCRYPTION_KEY || 'mySecretKey123456';

// Derive AES-128 key using SHA-256 truncated to 16 bytes (matches Java EncryptionUtil).
const getSecretKey = () => {
  const hash = createHash('sha256').update(Buffer.from(ENCRYPTION_KEY, 'utf8')).digest();
  return hash.subarray(0, 16);
};

/**
 * Decrypt AES-128/ECB/Base64 ciphertext, matching the Java EncryptionUtil used
 * by the Intutr pro server. Plaintext or non-AES-shaped values pass through
 * unchanged so legacy rows (local dev tenants with plain passwords) keep working.
 */
export const decryptPassword = (encryptedText) => {
  if (!encryptedText || encryptedText === '') return encryptedText;

  let decoded;
  try {
    decoded = Buffer.from(encryptedText, 'base64');
  } catch {
    return encryptedText; // Not valid base64, return as plaintext
  }

  if (decoded.length === 0 || decoded.length % 16 !== 0) {
    return encryptedText; // Not an AES block size multiple, treat as plaintext
  }

  try {
    const decipher = createDecipheriv('aes-128-ecb', getSecretKey(), null);
    decipher.setAutoPadding(true);
    const decrypted = Buffer.concat([decipher.update(decoded), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    throw new Error('Failed to decrypt password — encryption key may have changed');
  }
};
