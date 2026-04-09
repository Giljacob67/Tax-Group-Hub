import { webSearchTool } from "./search.js";
import { emailSenderTool } from "./email.js";

/**
 * Registry of all available tools for agents.
 */
export const availableTools = {
  webSearch: webSearchTool,
  emailSender: emailSenderTool,
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
