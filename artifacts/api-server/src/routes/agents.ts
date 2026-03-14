import { Router, type IRouter } from "express";
import { AGENTS, getAgentById } from "../lib/agents-data.js";

const router: IRouter = Router();

router.get("/agents", (_req, res) => {
  res.json({ agents: AGENTS });
});

router.get("/agents/:agentId", (req, res) => {
  const agent = getAgentById(req.params.agentId);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json(agent);
});

export default router;
