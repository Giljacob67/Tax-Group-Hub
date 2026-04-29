import { tool } from "ai";
import { z } from "zod";

export const webSearchTool = tool({
  description:
    "Busca informacoes recentes na internet para resolver duvidas, responder perguntas e obter contexto atualizado.",
  inputSchema: z.object({
    query: z.string().describe("A string de busca (em portugues) otimizada para a web."),
  }),
  execute: async ({ query }) => {
    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        result: `Modo simulacao. A ferramenta de busca esta sem chave configurada. Resultado simulado recebido para a busca por: "${query}". Para informacoes reais, configure a TAVILY_API_KEY.`,
      };
    }

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: "basic",
          include_answer: true,
          include_raw_content: false,
          max_results: 5,
        }),
      });

      const data = (await response.json()) as {
        answer?: string;
        results?: Array<{ title?: string; url?: string; content?: string }>;
      };

      return {
        success: true,
        answer: data.answer || "Nenhuma resposta de IA encontrada.",
        results: data.results?.map((result) => ({
          title: result.title,
          url: result.url,
          snippet: result.content,
        })),
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
});
