/**
 * AES-256-GCM encryption utilities for API key storage (BYOK).
 *
 * Reads a master key from the ENCRYPTION_KEY env var (64-char hex = 32 bytes).
 * ENCRYPTION_KEY is REQUIRED in every environment — both encrypt() and decrypt()
 * throw if it is missing or malformed. There is no plaintext fallback.
 *
 * Encrypted values are stored as:  iv:authTag:ciphertext  (all hex-encoded).
 *
 * decrypt() throws on failure (bad key, tampered ciphertext, wrong format).
 * Callers must handle DecryptionError — never propagate ciphertext as plaintext.
 */

import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128-bit IV for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag
const ENCRYPTED_FORMAT = /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i;

export class DecryptionError extends Error {
  constructor(public readonly cause?: unknown) {
    super(
      "Decryption failed — value may be tampered or ENCRYPTION_KEY has changed.",
    );
    this.name = "DecryptionError";
  }
}

function getMasterKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "[Crypto] ENCRYPTION_KEY ausente. Defina uma chave de 64 caracteres hex (32 bytes). " +
        "Gere com: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  if (hex.length !== 64 || !/^[0-9a-f]+$/i.test(hex)) {
    throw new Error(
      "[Crypto] ENCRYPTION_KEY inválida. Deve ter exatamente 64 caracteres hex (0-9, a-f).",
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Throws if ENCRYPTION_KEY is missing or malformed.
 */
export function encrypt(plaintext: string): string {
  if (typeof plaintext !== "string") {
    throw new TypeError("[Crypto] encrypt() expects a string.");
  }
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a value previously encrypted with encrypt().
 * Throws DecryptionError on any failure (bad key, wrong format, tampering).
 *
 * For graceful UI handling, callers can catch DecryptionError and surface a
 * "Re-enter this secret" prompt instead of treating the ciphertext as a key.
 */
export function decrypt(encryptedValue: string): string {
  if (typeof encryptedValue !== "string" || !encryptedValue) {
    throw new DecryptionError(new TypeError("empty or non-string input"));
  }
  if (!ENCRYPTED_FORMAT.test(encryptedValue)) {
    // Looks like a legacy plaintext or corrupted value — refuse rather than echo.
    throw new DecryptionError(
      new Error("value is not in encrypted format iv:tag:cipher"),
    );
  }

  const key = getMasterKey();
  const [ivHex, authTagHex, ciphertext] = encryptedValue.split(":");
  try {
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    throw new DecryptionError(err);
  }
}

/**
 * Best-effort decrypt for read paths that need to handle legacy plaintext
 * values already in the database. Returns the original string if it does not
 * match the encrypted format; throws DecryptionError if it looks encrypted but
 * cannot be decrypted.
 */
export function decryptTolerant(encryptedValue: string): string {
  if (typeof encryptedValue !== "string") return encryptedValue;
  if (!ENCRYPTED_FORMAT.test(encryptedValue)) {
    // Legacy plaintext — keep returning it for now, but log so the operator
    // can plan a rotation.
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[Crypto] decryptTolerant: legacy plaintext value detected. " +
          "Re-save the secret to encrypt it.",
      );
    }
    return encryptedValue;
  }
  return decrypt(encryptedValue);
}
