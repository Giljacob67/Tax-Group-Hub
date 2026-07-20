import logger from "./logger.js";

export interface SendEmailResult {
  success: boolean;
  deliveryId?: string;
  error?: string;
}

/**
 * Sends a transactional email via Resend. Falls back to a logged no-op when
 * RESEND_API_KEY is not configured, so environments without email set up
 * (e.g. local dev) don't crash — callers should surface `success: false` to
 * the operator rather than silently claiming delivery.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn(
      { to, subject },
      "[email] RESEND_API_KEY não configurada — e-mail não enviado",
    );
    return {
      success: false,
      error: "RESEND_API_KEY não configurada no servidor.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_SENDER || "agent@taxgroup-hub.ai",
        to,
        subject,
        html,
      }),
    });
    const data = (await response.json()) as Record<string, any>;
    if (!response.ok) {
      throw new Error(data.message || JSON.stringify(data));
    }
    return { success: true, deliveryId: data.id };
  } catch (err) {
    logger.error({ err, to }, "[email] falha ao enviar via Resend");
    return { success: false, error: (err as Error).message };
  }
}
