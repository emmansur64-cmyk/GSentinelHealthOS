import { Router } from "express";

import { getSettingsController, updateSettingsController } from "../controllers/settings.controller.js";
import { asyncHandler } from "../lib/async-handler.js";
import { validate } from "../middleware/validate.middleware.js";
import { updateSettingsSchema } from "../validators/settings.validators.js";

const router = Router();

router.get("/", asyncHandler(getSettingsController));
router.post("/", validate(updateSettingsSchema), asyncHandler(updateSettingsController));

export default router;
