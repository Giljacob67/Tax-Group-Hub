import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import agentsRouter from "./agents.js";
import conversationsRouter from "./conversations.js";
import knowledgeRouter from "./knowledge.js";
import integrationsRouter from "./integrations.js";
import settingsRouter from "./settings.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agentsRouter);
router.use(conversationsRouter);
router.use(knowledgeRouter);
router.use(integrationsRouter);
router.use(settingsRouter);

export default router;
