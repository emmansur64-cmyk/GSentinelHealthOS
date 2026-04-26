import { Router } from "express";

import appointmentsRoutes from "./appointments.routes.js";
import authRoutes from "./auth.routes.js";
import healthRoutes from "./health.routes.js";
import settingsRoutes from "./settings.routes.js";
import statsRoutes from "./stats.routes.js";

export function createApiRouter() {
  const router = Router();

  router.use("/health", healthRoutes);
  router.use("/auth", authRoutes);
  router.use("/appointments", appointmentsRoutes);
  router.use("/stats", statsRoutes);
  router.use("/settings", settingsRoutes);

  return router;
}
