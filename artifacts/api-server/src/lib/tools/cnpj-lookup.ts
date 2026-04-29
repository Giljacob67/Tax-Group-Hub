import { tool } from "ai";
import { z } from "zod";
import { EmpresAquiClient } from "@workspace/empresaqui";

export const cnpjLookupTool = tool({
  description:
    "Consulta dados e informacoes institucionais completos de uma empresa pelo CNPJ (via EmpresAqui). Retorna razao social, regime, telefone, endereco, porte e socios. Use isso quando voce receber o CNPJ de um lead.",
  inputSchema: z.object({
    cnpj: z.string().describe("O CNPJ da empresa, apenas numeros ou formatado."),
  }),
  execute: async ({ cnpj }) => {
    const apiKey = process.env.EMPRESAQUI_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        result: `Modo simulacao. A ferramenta CNPJ Lookup esta sem chave configurada (EMPRESAQUI_API_KEY). Simulacao: Empresa de Teste para o CNPJ ${cnpj}, Porte Medio, Lucro Presumido.`,
      };
    }

    try {
      const client = new EmpresAquiClient(apiKey);
      const data = await client.getCompanyByCNPJ(cnpj);
      return {
        success: true,
        company: data,
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
});
