import { webSearchTool } from "./search.js";
import { emailSenderTool } from "./email.js";
import { cnpjLookupTool } from "./cnpj-lookup.js";

/**
 * Registry of all available tools for agents.
 */
export const availableTools = {
  webSearch: webSearchTool,
  emailSender: emailSenderTool,
  cnpjLookup: cnpjLookupTool,
};

/**
 * Type helper for tool identifiers.
 */
export type ToolId = keyof typeof availableTools;

/**
 * Get a subset of tools by their identifiers.
 */
export function getTools(ids: ToolId[]) {
  const tools: Record<string, any> = {};
  for (const id of ids) {
    if (availableTools[id]) {
      tools[id] = availableTools[id];
    }
  }
  return tools;
}
