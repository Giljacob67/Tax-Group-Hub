import { tool } from "ai";
import { z } from "zod";

export const emailSenderTool = tool({
  description: "Envia um e-mail formal ou informal para um lead ou contato comercial.",
  inputSchema: z.object({
    to: z.string().email().describe("O endereco de e-mail do destinatario."),
    subject: z.string().describe("O assunto formal do e-mail."),
    body: z.string().describe("O conteudo do e-mail formatado em HTML simples."),
  }),
  execute: async ({ to, subject, body }) => {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.warn("[Email Tool] Simulacao ativada. Nenhuma RESEND_API_KEY configurada.");
      return {
        success: false,
        result: `Modo simulacao. A ferramenta de e-mail esta sem chave configurada. O e-mail para "${to}" com assunto "${subject}" simulou sucesso mas nao foi realmente enviado.`,
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
          html: body,
        }),
      });

      const data = (await response.json()) as { id?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.message || JSON.stringify(data));
      }

      return { success: true, deliveryId: data.id };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
});
