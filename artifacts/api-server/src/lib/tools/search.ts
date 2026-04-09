import { tool } from "ai";
import { z } from "zod";

export const webSearchTool = tool({
  description: "Busca informações recentes na internet para resolver dúvidas, responder perguntas e obter contexto atualizado.",
  parameters: z.object({
    query: z.string().describe("A string de busca (em português) otimizada para a web."),
  }),
  execute: async ({ query }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return { 
        success: false, 
        result: `Modo Simulação. A ferramenta de busca está sem chave configurada. Resultado simulado recebido para a busca por: "${query}". Para informações reais, configure a TAVILY_API_KEY.` 
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
          max_results: 5
        }),
      });
      const data = await response.json();
      return { 
        success: true, 
        answer: data.answer || "Nenhuma resposta de IA encontada.", 
        results: data.results?.map((r: any) => ({ title: r.title, url: r.url, snippet: r.content })) 
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
});
