import { Router } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { authenticate, requireRole } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import * as familyController from "./family.controller";
import { updateFamilySettingsSchema } from "./family.schemas";

export const familyRouter = Router();

familyRouter.use(authenticate, requireRole("PARENT"));

familyRouter.get("/settings", asyncHandler(familyController.getSettings));
familyRouter.patch("/settings", validateBody(updateFamilySettingsSchema), asyncHandler(familyController.updateSettings));
