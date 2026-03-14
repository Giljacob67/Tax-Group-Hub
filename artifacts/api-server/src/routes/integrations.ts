import { Router, type IRouter } from "express";
import OpenAI from "openai";

const router: IRouter = Router();

const imageGallery: Record<string, Array<{ url: string; prompt: string; createdAt: string }>> = {};

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  if (process.env.OPENROUTER_API_KEY) {
    return new OpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey: process.env.OPENROUTER_API_KEY });
  }
  return new OpenAI({ apiKey });
}

router.post("/integrations/generate-image", async (req, res) => {
  try {
    const { prompt, style, agentId } = req.body as { prompt?: string; style?: string; agentId?: string };
    if (!prompt?.trim()) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    const fullPrompt = style
      ? `${prompt}. Style: ${style}. Professional, high-quality, suitable for business context.`
      : `${prompt}. Professional, high-quality, suitable for business and tax consulting context.`;

    const geminiKey = process.env.GEMINI_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    let imageUrl: string;

    if (geminiKey) {
      try {
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
        interface GeminiPart { inlineData?: { mimeType: string; data: string }; text?: string }
        interface GeminiResponse { candidates?: Array<{ content?: { parts?: GeminiPart[] } }> }
        const data = (await response.json()) as GeminiResponse;
        const imagePart = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
        if (imagePart?.inlineData) {
          imageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        } else {
          throw new Error("No image in Gemini response");
        }
      } catch {
        imageUrl = `https://placehold.co/1024x1024/1E40AF/FFFFFF?text=${encodeURIComponent("Tax Group AI")}`;
      }
    } else if (openrouterKey) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${openrouterKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "dall-e-3", prompt: fullPrompt, n: 1, size: "1024x1024" }),
        });
        const data = (await response.json()) as { data?: Array<{ url?: string }> };
        imageUrl = data?.data?.[0]?.url || `https://placehold.co/1024x1024/1E40AF/FFFFFF?text=${encodeURIComponent(prompt.substring(0, 20))}`;
      } catch {
        imageUrl = `https://placehold.co/1024x1024/1E40AF/FFFFFF?text=${encodeURIComponent("Tax Group AI")}`;
      }
    } else {
      imageUrl = `https://placehold.co/1024x1024/1E40AF/FFFFFF?text=${encodeURIComponent(prompt.substring(0, 30))}`;
    }

    const galleryKey = agentId || "global";
    if (!imageGallery[galleryKey]) imageGallery[galleryKey] = [];
    imageGallery[galleryKey].unshift({ url: imageUrl, prompt: fullPrompt, createdAt: new Date().toISOString() });
    if (imageGallery[galleryKey].length > 20) imageGallery[galleryKey] = imageGallery[galleryKey].slice(0, 20);

    res.json({ imageUrl, prompt: fullPrompt, gallery: imageGallery[galleryKey] });
  } catch (err) {
    console.error("Error generating image:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/integrations/image-gallery/:agentId", (req, res) => {
  const { agentId } = req.params;
  res.json({ images: imageGallery[agentId] || [] });
});

router.post("/integrations/canva-link", async (req, res) => {
  try {
    const { contentType, title, description } = req.body as { contentType?: string; title?: string; description?: string };
    if (!contentType) {
      res.status(400).json({ error: "contentType is required" });
      return;
    }

    const canvaDesignTypes: Record<string, { type: string; label: string }> = {
      presentation: { type: "Presentation", label: "Apresentação" },
      social_post: { type: "SocialMedia", label: "Post para Redes Sociais" },
      document: { type: "Document", label: "Documento" },
      flyer: { type: "Flyer", label: "Flyer" },
      "post-linkedin": { type: "SocialMedia", label: "Post LinkedIn" },
      "email-header": { type: "EmailHeader", label: "Header de Email" },
      "one-pager": { type: "Document", label: "One-Pager" },
      banner: { type: "FacebookCover", label: "Banner" },
      infografico: { type: "Infographic", label: "Infográfico" },
      instagram: { type: "InstagramPost", label: "Post Instagram" },
    };

    const design = canvaDesignTypes[contentType] || { type: "Presentation", label: contentType };
    const encodedTitle = encodeURIComponent(title || `Tax Group - ${design.label}`);
    const url = `https://www.canva.com/design/new?designType=${design.type}&title=${encodedTitle}`;
    res.json({ url, contentType, label: design.label });
  } catch (err) {
    console.error("Error generating Canva link:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/integrations/search-knowledge", async (req, res) => {
  try {
    const { query, agentId, limit } = req.body as { query?: string; agentId?: string; limit?: number };
    if (!query?.trim()) {
      res.status(400).json({ error: "query is required" });
      return;
    }

    const googleApiKey = process.env.GEMINI_API_KEY;
    if (googleApiKey) {
      try {
        const embeddingResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${googleApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: "models/text-embedding-004", content: { parts: [{ text: query }] } }),
          }
        );
        interface EmbeddingResponse { error?: { message: string }; embedding?: { values: number[] } }
        const embeddingData = (await embeddingResponse.json()) as EmbeddingResponse;
        if (embeddingData.error) throw new Error(embeddingData.error.message);
        res.json({
          query,
          results: [{
            documentId: "demo",
            filename: "Dados Tax Group",
            content: `Resultado da busca semântica para: "${query}". Configure a base de conhecimento fazendo upload de documentos e use embeddings para busca avançada.`,
            score: 0.95,
          }],
        });
        return;
      } catch (embErr) {
        console.error("Embedding error:", embErr);
      }
    }

    res.json({
      query,
      results: [{
        documentId: "demo",
        filename: "Demo",
        content: `Busca por: "${query}". Configure GEMINI_API_KEY para busca semântica com embeddings reais.`,
        score: 0.5,
      }],
    });
  } catch (err) {
    console.error("Error searching knowledge:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
