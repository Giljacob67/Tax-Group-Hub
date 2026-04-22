import { tool } from "ai";
import { z } from "zod";

export const emailSenderTool = tool({
  description: "Envia um e-mail formal ou informal para um lead ou contato comercial.",
  parameters: z.object({
    to: z.string().email().describe("O endereço de e-mail do destinatário."),
    subject: z.string().describe("O assunto formal do e-mail."),
    body: z.string().describe("O conteúdo do e-mail formatado em HTML simples."),
  }),
  execute: async ({ to, subject, body }: { to: string; subject: string; body: string }) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[Email Tool] Simulação ativada. Nenhuma RESEND_API_KEY configurada.");
      return { 
        success: false, 
        result: `Modo Simulação. A ferramenta de e-mail está sem chave configurada. O e-mail para "${to}" com assunto "${subject}" SIMULOU sucesso mas NÃO FOI REALMENTE ENVIADO.` 
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
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || JSON.stringify(data));
      }
      return { success: true, deliveryId: data.id };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
});
