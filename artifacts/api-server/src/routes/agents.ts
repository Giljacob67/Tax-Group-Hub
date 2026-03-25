import { Router, type IRouter } from "express";
import { AGENTS, getAgentById } from "../lib/agents-data.js";

const router: IRouter = Router();

// List agents (hides systemPrompt for security)
router.get("/agents", (_req, res) => {
  const agents = AGENTS.map(({ systemPrompt: _, ...a }) => a);
  res.json({ agents });
});

// Search/filter agents
router.get("/agents/search", (req, res) => {
  const q = (req.query.q as string || "").toLowerCase().trim();
  const block = (req.query.block as string || "").trim();

  if (!q && !block) {
    res.status(400).json({ error: "Provide 'q' (search query) or 'block' (block filter) parameter" });
    return;
  }

  let agents = AGENTS;

  if (block) {
    agents = agents.filter(a => a.block === block);
  }

  if (q) {
    agents = agents.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q)
    );
  }

  res.json({
    count: agents.length,
    agents: agents.map(({ systemPrompt: _, ...a }) => a),
  });
});

// Get agent detail (includes systemPrompt — protect with API_KEY if set)
router.get("/agents/:agentId", (req, res) => {
  const apiKey = process.env.API_KEY;
  if (apiKey) {
    const authHeader = req.headers.authorization;
    const headerKey = req.headers["x-api-key"] as string;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (token !== apiKey && headerKey !== apiKey) {
      // Return agent without systemPrompt if not authenticated
      const agent = getAgentById(req.params.agentId);
      if (!agent) {
        res.status(404).json({ error: "Agent not found" });
        return;
      }
      const { systemPrompt: _, ...safe } = agent;
      res.json({ ...safe, systemPrompt: "[REDACTED — provide API key to view]" });
      return;
    }
  }

  const agent = getAgentById(req.params.agentId);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json(agent);
});

export default router;
