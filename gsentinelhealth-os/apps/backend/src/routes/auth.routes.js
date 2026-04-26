import { Router } from "express";

import { loginController } from "../controllers/auth.controller.js";
import { asyncHandler } from "../lib/async-handler.js";
import { validate } from "../middleware/validate.middleware.js";
import { loginSchema } from "../validators/auth.validators.js";

const router = Router();

router.post("/login", validate(loginSchema), asyncHandler(loginController));

export default router;
