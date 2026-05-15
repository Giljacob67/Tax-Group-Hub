import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import agentsRouter from "./agents.js";
import conversationsRouter from "./conversations.js";
import knowledgeRouter from "./knowledge.js";
import integrationsRouter from "./integrations.js";
import settingsRouter from "./settings.js";
import orchestrateRouter from "./orchestrate.js";
import automateRouter from "./automate.js";
import systemRouter from "./system.js";
import webhookRouter from "./webhooks.js";
import analyticsRouter from "./analytics.js";
import brandingRouter from "./branding.js";
import crmRouter from "./crm.js";
import llmConnectionsRouter from "./llm-connections.js";
import aiQualityRouter from "./ai-quality.js";
import deliverablesRouter from "./deliverables.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agentsRouter);
router.use(conversationsRouter);
router.use(knowledgeRouter);
router.use(integrationsRouter);
router.use(settingsRouter);
router.use(orchestrateRouter);
router.use(automateRouter);
router.use(systemRouter);
router.use(webhookRouter);
router.use(analyticsRouter);
router.use(brandingRouter);
router.use(llmConnectionsRouter);
router.use("/crm", crmRouter);
router.use(aiQualityRouter);
router.use(deliverablesRouter);

export default router;
