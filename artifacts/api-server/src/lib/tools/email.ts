import { tool } from "ai";
import { z } from "zod";
import { sendEmail } from "../email.js";

export const emailSenderTool = tool({
  description:
    "Envia um e-mail formal ou informal para um lead ou contato comercial.",
  inputSchema: z.object({
    to: z.string().email().describe("O endereço de e-mail do destinatário."),
    subject: z.string().describe("O assunto formal do e-mail."),
    body: z
      .string()
      .describe("O conteúdo do e-mail formatado em HTML simples."),
  }),
  execute: async (
    { to, subject, body }: { to: string; subject: string; body: string },
    _options,
  ) => {
    const result = await sendEmail(to, subject, body);
    if (!result.success) {
      return {
        success: false,
        result: `A ferramenta de e-mail não conseguiu enviar para "${to}" com assunto "${subject}": ${result.error}`,
      };
    }
    return result;
  },
});
