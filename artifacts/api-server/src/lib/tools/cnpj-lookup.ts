import { tool } from "ai";
import { z } from "zod";
import { EmpresAquiClient } from "@workspace/empresaqui";

export const cnpjLookupTool = tool({
  description: "Consulta dados e informações institucionais completos de uma empresa pelo CNPJ (via EmpresAqui). Retorna razão social, regime, telefone, endereço, porte e sócios. Use isso quando você receber o CNPJ de um lead.",
  parameters: z.object({
    cnpj: z.string().describe("O CNPJ da empresa, apenas números ou formatado."),
  }),
  execute: async ({ cnpj }: { cnpj: string }) => {
    // In a real scenario, this key could be fetched from the db (via apiKeyTable) per user.
    // For tool definitions without req context, we use the system env key fallback or simulation.
    const apiKey = process.env.EMPRESAQUI_API_KEY;
    if (!apiKey) {
      return { 
        success: false, 
        result: `Modo Simulação. A ferramenta CNPJ Lookup está sem chave configurada (EMPRESAQUI_API_KEY). Simulação: Empresa de Teste para o CNPJ ${cnpj}, Porte Médio, Lucro Presumido.` 
      };
    }

    try {
      const client = new EmpresAquiClient(apiKey);
      const data = await client.getCompanyByCNPJ(cnpj);
      return { 
        success: true, 
        company: data 
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
});
