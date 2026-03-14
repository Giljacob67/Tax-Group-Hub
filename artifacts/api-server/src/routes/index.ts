import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import agentsRouter from "./agents.js";
import conversationsRouter from "./conversations.js";
import knowledgeRouter from "./knowledge.js";
import integrationsRouter from "./integrations.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agentsRouter);
router.use(conversationsRouter);
router.use(knowledgeRouter);
router.use(integrationsRouter);

export default router;
