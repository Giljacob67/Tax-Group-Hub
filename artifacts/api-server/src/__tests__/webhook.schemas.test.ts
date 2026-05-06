import { describe, it, expect } from "vitest";
import { z } from "zod";

// ── Re-declare schemas here to test them in isolation ─────────────────────────
// These mirror the schemas in routes/webhooks.ts exactly.

const TelegramPhotoSize = z.object({ file_id: z.string() });

const TelegramMessage = z.object({
  message_id: z.number(),
  chat: z.object({ id: z.union([z.number(), z.string()]) }),
  text: z.string().optional(),
  voice: z.object({ file_id: z.string() }).optional(),
  document: z.object({
    file_id: z.string(),
    file_name: z.string().optional(),
    mime_type: z.string().optional(),
  }).optional(),
  photo: z.array(TelegramPhotoSize).optional(),
});

const TelegramUpdate = z.object({
  update_id: z.number(),
  message: TelegramMessage.optional(),
}).passthrough();

const TelegramFileResponse = z.object({
  result: z.object({ file_path: z.string() }),
});

const CrmInboundPayload = z.record(z.unknown());

// ── TelegramUpdate ────────────────────────────────────────────────────────────

describe("TelegramUpdate schema", () => {
  it("accepts a minimal valid update (no message)", () => {
    const result = TelegramUpdate.safeParse({ update_id: 1 });
    expect(result.success).toBe(true);
  });

  it("accepts a text message", () => {
    const result = TelegramUpdate.safeParse({
      update_id: 42,
      message: { message_id: 1, chat: { id: 12345 }, text: "hello" },
    });
    expect(result.success).toBe(true);
    expect(result.data?.message?.text).toBe("hello");
  });

  it("accepts a voice message", () => {
    const result = TelegramUpdate.safeParse({
      update_id: 1,
      message: { message_id: 1, chat: { id: 1 }, voice: { file_id: "abc" } },
    });
    expect(result.success).toBe(true);
    expect(result.data?.message?.voice?.file_id).toBe("abc");
  });

  it("accepts a document message", () => {
    const result = TelegramUpdate.safeParse({
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: 1 },
        document: { file_id: "doc123", file_name: "contract.pdf", mime_type: "application/pdf" },
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a photo message (array of sizes)", () => {
    const result = TelegramUpdate.safeParse({
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: 1 },
        photo: [{ file_id: "small" }, { file_id: "large" }],
      },
    });
    expect(result.success).toBe(true);
    expect(result.data?.message?.photo).toHaveLength(2);
  });

  it("accepts unknown update types via passthrough (e.g. callback_query)", () => {
    const result = TelegramUpdate.safeParse({
      update_id: 1,
      callback_query: { id: "cbq", data: "button_press" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-object payload", () => {
    expect(TelegramUpdate.safeParse(null).success).toBe(false);
    expect(TelegramUpdate.safeParse("text").success).toBe(false);
    expect(TelegramUpdate.safeParse(42).success).toBe(false);
  });

  it("rejects missing update_id", () => {
    const result = TelegramUpdate.safeParse({ message: { message_id: 1, chat: { id: 1 } } });
    expect(result.success).toBe(false);
  });

  it("rejects message without chat.id", () => {
    const result = TelegramUpdate.safeParse({
      update_id: 1,
      message: { message_id: 1, chat: {} },
    });
    expect(result.success).toBe(false);
  });

  it("rejects message where voice.file_id is missing", () => {
    const result = TelegramUpdate.safeParse({
      update_id: 1,
      message: { message_id: 1, chat: { id: 1 }, voice: {} },
    });
    expect(result.success).toBe(false);
  });

  it("rejects photo array containing an entry without file_id", () => {
    const result = TelegramUpdate.safeParse({
      update_id: 1,
      message: { message_id: 1, chat: { id: 1 }, photo: [{ width: 100 }] },
    });
    expect(result.success).toBe(false);
  });
});

// ── TelegramFileResponse ──────────────────────────────────────────────────────

describe("TelegramFileResponse schema", () => {
  it("accepts valid response", () => {
    const result = TelegramFileResponse.safeParse({
      ok: true,
      result: { file_id: "abc", file_path: "photos/file.jpg" },
    });
    expect(result.success).toBe(true);
    expect(result.data?.result.file_path).toBe("photos/file.jpg");
  });

  it("rejects response without result.file_path", () => {
    expect(TelegramFileResponse.safeParse({ ok: true, result: {} }).success).toBe(false);
    expect(TelegramFileResponse.safeParse({ ok: false }).success).toBe(false);
  });
});

// ── CrmInboundPayload ─────────────────────────────────────────────────────────

describe("CrmInboundPayload schema", () => {
  it("accepts a standard lead payload", () => {
    const result = CrmInboundPayload.safeParse({
      cnpj: "12.345.678/0001-99",
      name: "Empresa LTDA",
      email: "contato@empresa.com",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty object (CNPJ check is done at route level)", () => {
    expect(CrmInboundPayload.safeParse({}).success).toBe(true);
  });

  it("rejects a non-object body", () => {
    expect(CrmInboundPayload.safeParse(null).success).toBe(false);
    expect(CrmInboundPayload.safeParse("cnpj=123").success).toBe(false);
    expect(CrmInboundPayload.safeParse([1, 2, 3]).success).toBe(false);
  });
});
