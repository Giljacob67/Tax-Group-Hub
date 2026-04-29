/**
 * AES-256-GCM encryption utilities for API key storage (BYOK).
 *
 * Reads a master key from the ENCRYPTION_KEY env var (64-char hex = 32 bytes).
 * If no ENCRYPTION_KEY is set, encryption/decryption is a no-op (pass-through)
 * to maintain backwards compatibility with existing plaintext keys.
 *
 * Encrypted values are stored as:  iv:authTag:ciphertext  (all hex-encoded).
 */

import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128-bit IV for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function getMasterKey(): Buffer | null {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) return null;
  if (hex.length !== 64) {
    console.warn("[Crypto] ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Encryption disabled.");
    return null;
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a plaintext string.
 * Returns the original string unchanged if ENCRYPTION_KEY is not configured.
 */
export function encrypt(plaintext: string): string {
  const key = getMasterKey();
  if (!key) {
    if (isProductionEnvironment()) {
      throw new Error("ENCRYPTION_KEY is required in production for BYOK.");
    }
    return plaintext;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a value previously encrypted with encrypt().
 * If the value doesn't look encrypted (no colons), returns it as-is
 * to handle legacy plaintext keys gracefully.
 */
export function decrypt(encryptedValue: string): string {
  const key = getMasterKey();
  if (!key) return encryptedValue;

  // Legacy plaintext detection: encrypted values always have format iv:tag:cipher
  const parts = encryptedValue.split(":");
  if (parts.length !== 3) return encryptedValue; // Plaintext — return as-is

  const [ivHex, authTagHex, ciphertext] = parts;

  try {
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    // If decryption fails (wrong key, corrupted data), return raw value
    // so the app doesn't crash — the key simply won't work at the provider.
    console.warn("[Crypto] Decryption failed — returning raw value. Key may be corrupted or ENCRYPTION_KEY changed.");
    return encryptedValue;
  }
}
