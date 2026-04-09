/**
 * Media Processor for Omnichannel Agents.
 * Orchestrates transcription, OCR and document extraction.
 */

import { transcribeAudio, callLLM, getLanguageModel } from "./llm-client.js";
import { extractTextContent } from "../routes/knowledge.js";
import { generateText } from "ai";

export interface ProcessedMedia {
  type: "text" | "image" | "audio" | "document";
  content: string; // Transcribed text or extracted text
  mimeType: string;
}

/**
 * Process a media file from a URL or Buffer.
 */
export async function processExternalMedia(
  mediaSource: Buffer | string,
  mimeType: string,
  fileName: string
): Promise<ProcessedMedia> {
  let buffer: Buffer;
  
  if (typeof mediaSource === "string") {
    // Download if it's a URL
    const response = await fetch(mediaSource);
    if (!response.ok) throw new Error(`Failed to download media: ${response.statusText}`);
    buffer = Buffer.from(await response.arrayBuffer());
  } else {
    buffer = mediaSource;
  }

  // 1. AUDIO (WhatsApp/Telegram Voice notes)
  if (mimeType.startsWith("audio/")) {
    console.log(`[MediaProcessor] Transcribing audio: ${fileName} (${mimeType})...`);
    const text = await transcribeAudio(buffer, fileName);
    return { type: "audio", content: text, mimeType };
  }

  // 2. IMAGE (OCR / Vision)
  if (mimeType.startsWith("image/")) {
    console.log(`[MediaProcessor] Analyzing image: ${fileName} (${mimeType})...`);
    // Use Vision via LLM
    const { model } = await getLanguageModel("google", "gemini-1.5-flash"); // Flash is fast for OCR
    
    const { text } = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Descreva o que está nesta imagem ou transcreva o texto se for um documento/nota fiscal. Recupere o máximo de detalhes possível." },
            { type: "image", image: buffer, mimeType },
          ],
        },
      ],
    });

    return { type: "image", content: text, mimeType };
  }

  // 3. DOCUMENTS (PDF, DOCX)
  if (mimeType.includes("pdf") || mimeType.includes("word") || mimeType.includes("officedocument") || mimeType.includes("text/")) {
    console.log(`[MediaProcessor] Extracting text from document: ${fileName} (${mimeType})...`);
    const text = await extractTextContent(buffer, mimeType, fileName);
    return { type: "document", content: text, mimeType };
  }

  // Fallback
  return { type: "text", content: "[Mídia não suportada]", mimeType };
}
