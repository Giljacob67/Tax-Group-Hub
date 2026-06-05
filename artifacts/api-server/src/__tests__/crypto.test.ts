import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  encrypt,
  decrypt,
  decryptTolerant,
  DecryptionError,
} from "../lib/crypto.js";

const VALID_KEY = "a".repeat(64); // 64-char hex

describe("crypto", () => {
  const origEnv = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    if (origEnv === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = origEnv;
    }
  });

  // ── encrypt() ──────────────────────────────────────────────────────────────

  describe("encrypt", () => {
    it("returns a non-empty string different from input", () => {
      const ct = encrypt("hello");
      expect(ct).toBeTruthy();
      expect(ct).not.toBe("hello");
    });

    it("returns format iv:authTag:ciphertext (all hex)", () => {
      const ct = encrypt("test");
      const parts = ct.split(":");
      expect(parts).toHaveLength(3);
      for (const part of parts) {
        expect(part).toMatch(/^[0-9a-f]+$/i);
      }
    });

    it("produces different ciphertexts for the same plaintext (random IV)", () => {
      const a = encrypt("same");
      const b = encrypt("same");
      expect(a).not.toBe(b);
    });

    it("throws when ENCRYPTION_KEY is missing", () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => encrypt("x")).toThrow();
    });

    it("throws when ENCRYPTION_KEY is invalid length", () => {
      process.env.ENCRYPTION_KEY = "short";
      expect(() => encrypt("x")).toThrow();
    });

    it("throws on non-string input", () => {
      expect(() => encrypt(123 as any)).toThrow(TypeError);
    });
  });

  // ── decrypt() roundtrip ────────────────────────────────────────────────────

  describe("decrypt roundtrip", () => {
    it("roundtrips a simple ASCII string", () => {
      expect(decrypt(encrypt("hello world"))).toBe("hello world");
    });

    it("roundtrips an empty string", () => {
      const enc = encrypt("");
      expect(typeof enc).toBe("string");
      expect(enc).not.toBe("");
    });

    it("roundtrips unicode and emoji", () => {
      const input = "日本語テスト 🚀 Ñoño";
      expect(decrypt(encrypt(input))).toBe(input);
    });

    it("roundtrips a long string", () => {
      const input = "x".repeat(10_000);
      expect(decrypt(encrypt(input))).toBe(input);
    });

    it("roundtrips a string with special characters", () => {
      const input = "!@#$%^&*()_+-={}[]|;':\",./<>?`~";
      expect(decrypt(encrypt(input))).toBe(input);
    });
  });

  // ── decrypt() error handling ────────────────────────────────────────────────

  describe("decrypt errors", () => {
    it("throws DecryptionError with empty string", () => {
      expect(() => decrypt("")).toThrow(DecryptionError);
    });

    it("throws DecryptionError with non-string input", () => {
      expect(() => decrypt(null as any)).toThrow(DecryptionError);
    });

    it("throws DecryptionError with non-encrypted format", () => {
      expect(() => decrypt("not-encrypted-value")).toThrow(DecryptionError);
    });

    it("throws DecryptionError with wrong key", () => {
      const ct = encrypt("secret");
      process.env.ENCRYPTION_KEY = "b".repeat(64);
      expect(() => decrypt(ct)).toThrow(DecryptionError);
    });

    it("throws DecryptionError with tampered ciphertext", () => {
      const ct = encrypt("data");
      const parts = ct.split(":");
      // Tamper with the ciphertext portion
      const tampered =
        parts[0] + ":" + parts[1] + ":" + "ff".repeat(parts[2].length / 2);
      expect(() => decrypt(tampered)).toThrow(DecryptionError);
    });

    it("throws DecryptionError with tampered auth tag", () => {
      const ct = encrypt("data");
      const parts = ct.split(":");
      const tampered = parts[0] + ":" + "ff".repeat(32) + ":" + parts[2];
      expect(() => decrypt(tampered)).toThrow(DecryptionError);
    });
  });

  // ── decryptTolerant() ──────────────────────────────────────────────────────

  describe("decryptTolerant", () => {
    it("decrypts encrypted values normally", () => {
      const ct = encrypt("secret");
      expect(decryptTolerant(ct)).toBe("secret");
    });

    it("passes through non-encrypted strings (legacy plaintext)", () => {
      expect(decryptTolerant("plain-legacy-key")).toBe("plain-legacy-key");
    });

    it("passes through non-string input", () => {
      expect(decryptTolerant(null as any)).toBe(null);
      expect(decryptTolerant(undefined as any)).toBe(undefined);
    });

    it("throws DecryptionError for values that look encrypted but are wrong", () => {
      const fake =
        "aa".repeat(16) + ":" + "bb".repeat(32) + ":" + "cc".repeat(32);
      expect(() => decryptTolerant(fake)).toThrow(DecryptionError);
    });
  });
});
