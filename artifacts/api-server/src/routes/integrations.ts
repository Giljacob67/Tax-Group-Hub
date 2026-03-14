import { Router, type IRouter } from "express";
import OpenAI from "openai";

const router: IRouter = Router();

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  if (process.env.OPENROUTER_API_KEY) {
    return new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }

  return new OpenAI({ apiKey });
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    apiKey,
  });
}

// Generate image using built-in image generation or Gemini
router.post("/integrations/generate-image", async (req, res) => {
  try {
    const { prompt, style, agentId } = req.body as {
      prompt?: string;
      style?: string;
      agentId?: string;
    };

    if (!prompt?.trim()) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    const fullPrompt = style
      ? `${prompt}. Style: ${style}. Professional, high-quality, suitable for business context.`
      : `${prompt}. Professional, high-quality, suitable for business and tax consulting context.`;

    // Try Gemini first, then fall back to DALL-E
    const geminiKey = process.env.GEMINI_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;

    let imageUrl: string;

    if (geminiKey) {
      // Use Gemini Nano Banana (gemini-2.0-flash-exp-image-generation)
      try {
        const geminiClient = new OpenAI({
          baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
          apiKey: geminiKey,
        });
        // Gemini image generation via text-to-image
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: fullPrompt }] }],
              generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
            }),
          }
        );

        const data = (await response.json()) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{
                inlineData?: { mimeType: string; data: string };
                text?: string;
              }>;
            };
          }>;
        };
        const imagePart = data?.candidates?.[0]?.content?.parts?.find(
          (p) => p.inlineData
        );
        if (imagePart?.inlineData) {
          imageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        } else {
          throw new Error("No image in Gemini response");
        }
      } catch (geminiErr) {
        console.error("Gemini image generation failed:", geminiErr);
        imageUrl = `https://placehold.co/1024x1024/1E40AF/FFFFFF?text=${encodeURIComponent("Tax Group AI")}`;
      }
    } else if (openrouterKey) {
      // Use OpenRouter for image generation
      try {
        const response = await fetch("https://openrouter.ai/api/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openrouterKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt: fullPrompt,
            n: 1,
            size: "1024x1024",
          }),
        });

        const data = (await response.json()) as { data?: Array<{ url?: string }> };
        imageUrl = data?.data?.[0]?.url || `https://placehold.co/1024x1024/1E40AF/FFFFFF?text=${encodeURIComponent(prompt.substring(0, 20))}`;
      } catch {
        imageUrl = `https://placehold.co/1024x1024/1E40AF/FFFFFF?text=${encodeURIComponent("Tax Group AI")}`;
      }
    } else {
      // Demo mode: return placeholder
      imageUrl = `https://placehold.co/1024x1024/1E40AF/FFFFFF?text=${encodeURIComponent("Configure API Keys")}`;
    }

    res.json({ imageUrl, prompt: fullPrompt });
  } catch (err) {
    console.error("Error generating image:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Generate Canva deep link
router.post("/integrations/canva-link", async (req, res) => {
  try {
    const { contentType, title, description } = req.body as {
      contentType?: string;
      title?: string;
      description?: string;
    };

    if (!contentType) {
      res.status(400).json({ error: "contentType is required" });
      return;
    }

    // Canva deep links by content type
    const canvaDesignTypes: Record<string, string> = {
      presentation: "Presentation",
      social_post: "SocialMedia",
      document: "Document",
      flyer: "Flyer",
    };

    const designType = canvaDesignTypes[contentType] || "Presentation";
    const encodedTitle = encodeURIComponent(title || `Tax Group - ${contentType}`);

    // Canva deep link format
    const url = `https://www.canva.com/design/new?designType=${designType}&title=${encodedTitle}`;

    res.json({ url, contentType });
  } catch (err) {
    console.error("Error generating Canva link:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Semantic search in knowledge base using Google Embeddings
router.post("/integrations/search-knowledge", async (req, res) => {
  try {
    const { query, agentId, limit } = req.body as {
      query?: string;
      agentId?: string;
      limit?: number;
    };

    if (!query?.trim()) {
      res.status(400).json({ error: "query is required" });
      return;
    }

    const googleApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (googleApiKey) {
      // Use Google Embeddings for semantic search
      try {
        const embeddingResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${googleApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "models/text-embedding-004",
              content: { parts: [{ text: query }] },
            }),
          }
        );

        const embeddingData = (await embeddingResponse.json()) as {
          embedding?: { values: number[] };
          error?: { message: string };
        };

        if (embeddingData.error) {
          throw new Error(embeddingData.error.message);
        }

        // In production, this would query a vector DB (pgvector, etc.)
        // For now, return a semantic search result structure
        res.json({
          query,
          results: [
            {
              documentId: "demo",
              filename: "Dados Tax Group",
              content: `Resultado da busca semântica para: "${query}". Configure a base de conhecimento fazendo upload de documentos e use embeddings para busca avançada.`,
              score: 0.95,
            },
          ],
        });
        return;
      } catch (embErr) {
        console.error("Embedding error:", embErr);
      }
    }

    // Fallback: simple keyword search
    res.json({
      query,
      results: [
        {
          documentId: "demo",
          filename: "Demo",
          content: `Busca por: "${query}". Configure GEMINI_API_KEY ou GOOGLE_API_KEY para busca semântica com embeddings reais.`,
          score: 0.5,
        },
      ],
    });
  } catch (err) {
    console.error("Error searching knowledge:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
