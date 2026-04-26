import { Router } from "express";

import {
  createAppointmentController,
  deleteAppointmentController,
  getAppointmentsController,
  patchAppointmentController,
} from "../controllers/appointments.controller.js";
import { asyncHandler } from "../lib/async-handler.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  createAppointmentSchema,
  deleteAppointmentSchema,
  getAppointmentsSchema,
  patchAppointmentSchema,
} from "../validators/appointments.validators.js";

const router = Router();

router.get("/", validate(getAppointmentsSchema), asyncHandler(getAppointmentsController));
router.post("/", validate(createAppointmentSchema), asyncHandler(createAppointmentController));
router.patch("/:id", validate(patchAppointmentSchema), asyncHandler(patchAppointmentController));
router.delete("/:id", validate(deleteAppointmentSchema), asyncHandler(deleteAppointmentController));

export default router;
