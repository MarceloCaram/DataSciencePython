import { Router } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { authenticate, requireRole } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import * as childrenController from "./children.controller";
import { createChildSchema, updateChildSchema } from "./children.schemas";

export const childrenRouter = Router();

childrenRouter.use(authenticate);

// Must be declared before "/:id" so "me" isn't captured as an :id param.
childrenRouter.get("/me", requireRole("CHILD"), asyncHandler(childrenController.getOwnChild));

childrenRouter.post("/", requireRole("PARENT"), validateBody(createChildSchema), asyncHandler(childrenController.createChild));
childrenRouter.get("/", requireRole("PARENT"), asyncHandler(childrenController.listChildren));
childrenRouter.get("/:id", requireRole("PARENT"), asyncHandler(childrenController.getChild));
childrenRouter.patch(
  "/:id",
  requireRole("PARENT"),
  validateBody(updateChildSchema),
  asyncHandler(childrenController.updateChild),
);
