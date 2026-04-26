import { Router } from "express";

import { getTodayStatsController } from "../controllers/stats.controller.js";
import { asyncHandler } from "../lib/async-handler.js";

const router = Router();

router.get("/today", asyncHandler(getTodayStatsController));

export default router;
