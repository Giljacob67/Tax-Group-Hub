export interface ProviderMeta {
  id: string;
  name: string;
  label: string;
  icon: string;
  color: string;
  ring: string;
  dot: string;
  supportsDiscovery: boolean;
  needsBaseUrl: boolean;
  baseUrlPlaceholder?: string;
  keyLabel: string;
  keyPlaceholder: string;
}

export interface DiscoveredModel {
  id: string;
  name: string;
  contextWindow?: number;
  maxTokens?: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
  supportsJson?: boolean;
  priceInput?: string;
  priceOutput?: string;
  providerMetadata?: Record<string, unknown>;
}

export interface LlmConnection {
  id: number;
  userId: string | null;
  name: string;
  provider: string;
  baseUrl: string | null;
  modelId: string;
  modelName: string;
  contextWindow: number | null;
  maxTokens: number | null;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsJson: boolean;
  priceInput: string | null;
  priceOutput: string | null;
  providerMetadata: Record<string, unknown> | null;
  usageType: string;
  isDefault: boolean;
  isActive: boolean;
  lastTestedAt: string | null;
  lastTestStatus: string;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  hasKey: boolean;
}

export interface LlmProfile {
  id: number;
  userId: string;
  name: string;
  description: string | null;
  chatConnectionId: number | null;
  fastConnectionId: number | null;
  reasoningConnectionId: number | null;
  visionConnectionId: number | null;
  embeddingConnectionId: number | null;
  imageConnectionId: number | null;
  transcriptionConnectionId: number | null;
  isDefault: boolean;
  isActive: boolean;
}

export type UsageType =
  | "chat"
  | "fast"
  | "reasoning"
  | "vision"
  | "embedding"
  | "image"
  | "transcription";

export const USAGE_TYPES: { id: UsageType; label: string; icon: string }[] = [
  { id: "chat", label: "Chat Geral", icon: "💬" },
  { id: "fast", label: "Respostas Rápidas", icon: "⚡" },
  { id: "reasoning", label: "Raciocínio Complexo", icon: "🧠" },
  { id: "vision", label: "Análise de Imagem", icon: "👁️" },
  { id: "embedding", label: "Embeddings", icon: "📎" },
  { id: "image", label: "Geração de Imagem", icon: "🎨" },
  { id: "transcription", label: "Transcrição", icon: "🎙️" },
];
