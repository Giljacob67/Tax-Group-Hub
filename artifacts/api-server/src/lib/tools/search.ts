import { tool } from "ai";
import { z } from "zod";

const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";

export const webSearchTool = tool({
  description: "Busca informações recentes na internet para resolver dúvidas, responder perguntas e obter contexto atualizado.",
  inputSchema: z.object({
    query: z.string().describe("A string de busca (em português) otimizada para a web."),
  }),
  execute: async ({ query }: { query: string }, _options) => {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        result: `Modo Simulação. A ferramenta de busca está sem chave configurada. Resultado simulado para: "${query}". Configure PERPLEXITY_API_KEY para buscas reais.`,
      };
    }

    try {
      const response = await fetch(PERPLEXITY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [{ role: "user", content: query }],
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return { success: false, error: `Perplexity ${response.status}: ${errText}` };
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        citations?: string[];
      };

      const answer = data.choices?.[0]?.message?.content || "Nenhuma resposta encontrada.";
      const citations = data.citations || [];

      return {
        success: true,
        answer,
        results: citations.map((url, i) => ({ title: `Fonte ${i + 1}`, url, snippet: url })),
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
});
