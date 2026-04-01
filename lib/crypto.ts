/**
 * AES-256-GCM encryption for biometric face vectors
 * LGPD compliance: face vectors are always stored encrypted
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96-bit IV for GCM

function getKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return key;
}

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function importKey(hex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    hexToBuffer(hex),
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a face vector (Float32Array) into an encrypted Buffer
 * Returns IV (12 bytes) + ciphertext concatenated
 */
export async function encryptFaceVector(vector: Float32Array): Promise<Buffer> {
  const key = await importKey(getKey());
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    vector.buffer as ArrayBuffer
  );

  const result = new Uint8Array(IV_LENGTH + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), IV_LENGTH);

  return Buffer.from(result);
}

/**
 * Decrypts a face vector from an encrypted Buffer
 */
export async function decryptFaceVector(encrypted: Buffer): Promise<Float32Array> {
  const key = await importKey(getKey());
  const data = new Uint8Array(encrypted);

  const iv = data.slice(0, IV_LENGTH);
  const ciphertext = data.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  return new Float32Array(decrypted);
}

/**
 * Server-side encryption using Node.js crypto (for API routes)
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export function encryptFaceVectorSync(vector: Float32Array): Buffer {
  const keyHex = getKey();
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const vectorBuffer = Buffer.from(vector.buffer);

  const encrypted = Buffer.concat([cipher.update(vectorBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: IV (12) + AuthTag (16) + Ciphertext
  return Buffer.concat([iv, authTag, encrypted]);
}

export function decryptFaceVectorSync(data: Buffer): Float32Array {
  const keyHex = getKey();
  const key = Buffer.from(keyHex, 'hex');

  const iv = data.slice(0, IV_LENGTH);
  const authTag = data.slice(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = data.slice(IV_LENGTH + 16);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return new Float32Array(decrypted.buffer, decrypted.byteOffset, decrypted.byteLength / 4);
}
