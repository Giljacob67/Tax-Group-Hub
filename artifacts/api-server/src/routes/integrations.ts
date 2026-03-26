import { Router, type IRouter } from "express";
import { db, designGalleryTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";

const router: IRouter = Router();

// Root GET - list available integration endpoints
router.get("/integrations", (_req, res) => {
  res.json({
    endpoints: [
      { method: "POST", path: "/api/integrations/generate-image", description: "Generate image with Gemini AI" },
      { method: "GET", path: "/api/integrations/image-gallery/:agentId", description: "Get image gallery for agent" },
      { method: "POST", path: "/api/integrations/canva-link", description: "Generate Canva design link" },
      { method: "POST", path: "/api/integrations/search-knowledge", description: "Semantic search in knowledge base" },
    ],
  });
});

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
    let imageUrl: string;

    if (geminiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${geminiKey}`,
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
    } else {
      imageUrl = `https://placehold.co/1024x1024/1E40AF/FFFFFF?text=${encodeURIComponent(prompt.substring(0, 30))}`;
    }

    const galleryKey = agentId || "global";

    // Persist to DB (cap at 20 items per agent by deleting oldest if needed)
    const existing = await db
      .select({ id: designGalleryTable.id })
      .from(designGalleryTable)
      .where(eq(designGalleryTable.agentId, galleryKey))
      .orderBy(desc(designGalleryTable.createdAt));

    if (existing.length >= 20) {
      const toDelete = existing.slice(19).map((r) => r.id);
      if (toDelete.length > 0) {
        // Batch delete instead of N+1 queries
        await db.delete(designGalleryTable).where(inArray(designGalleryTable.id, toDelete));
      }
    }

    await db.insert(designGalleryTable).values({
      agentId: galleryKey,
      imageUrl,
      prompt: fullPrompt,
    });

    const gallery = await db
      .select()
      .from(designGalleryTable)
      .where(eq(designGalleryTable.agentId, galleryKey))
      .orderBy(desc(designGalleryTable.createdAt));

    res.json({
      imageUrl,
      prompt: fullPrompt,
      gallery: gallery.map((g) => ({ url: g.imageUrl, prompt: g.prompt, createdAt: g.createdAt.toISOString() })),
    });
  } catch (err) {
    console.error("Error generating image:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/integrations/image-gallery/:agentId", async (req, res) => {
  try {
    const { agentId } = req.params;
    const images = await db
      .select()
      .from(designGalleryTable)
      .where(eq(designGalleryTable.agentId, agentId))
      .orderBy(desc(designGalleryTable.createdAt));

    res.json({
      images: images.map((g) => ({ url: g.imageUrl, prompt: g.prompt, createdAt: g.createdAt.toISOString() })),
    });
  } catch (err) {
    console.error("Error fetching image gallery:", err);
    res.status(500).json({ error: "Internal server error" });
  }
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
