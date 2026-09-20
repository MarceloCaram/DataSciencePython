import { Router } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { authenticate, requireRole } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import * as authController from "./auth.controller";
import { loginChildSchema, loginParentSchema, registerParentSchema, setChildPinSchema } from "./auth.schemas";

export const authRouter = Router();

authRouter.post("/parent/register", validateBody(registerParentSchema), asyncHandler(authController.registerParent));
authRouter.post("/parent/login", validateBody(loginParentSchema), asyncHandler(authController.loginParent));
authRouter.post("/child/login", validateBody(loginChildSchema), asyncHandler(authController.loginChild));
authRouter.post(
  "/child/pin",
  authenticate,
  requireRole("PARENT"),
  validateBody(setChildPinSchema),
  asyncHandler(authController.setChildPin),
);
