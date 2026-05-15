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
  description?: string;
  tag?: "cloud" | "local" | "compatible";
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

// ─── Diagnostics Types ────────────────────────────────────────────────────────

export type DiagnosticStage = "auth" | "models" | "chat" | "json" | "tools";

export interface DiagnosticResult {
  ok: boolean;
  stage: DiagnosticStage;
  status?: number;
  latencyMs: number;
  message: string;
  userMessage: string;
  howToFix?: string;
  technicalDetails?: string;
  capabilities?: {
    tools?: boolean;
    json?: boolean;
    vision?: boolean;
    contextWindow?: number;
  };
}

export interface ConnectionDiagnostics {
  connectionId: number;
  results: DiagnosticResult[];
  overall: "ok" | "warning" | "error";
}

export type ProviderCardStatus =
  | "online"
  | "unconfigured"
  | "error"
  | "offline"
  | "no_models"
  | "attention_required";

export interface WizardStep {
  id: number;
  label: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  { id: 1, label: "Provedor" },
  { id: 2, label: "Credenciais" },
  { id: 3, label: "Validar" },
  { id: 4, label: "Modelos" },
  { id: 5, label: "Finalidade" },
  { id: 6, label: "Testar" },
  { id: 7, label: "Salvar" },
];

export interface HealthCheckResult {
  connectionId: number;
  name: string;
  provider: string;
  diagnostics?: ConnectionDiagnostics;
  error?: string;
}
