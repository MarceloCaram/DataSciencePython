import { Router } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { authenticate, requireRole } from "../../middleware/auth";
import { validateBody, validateQuery } from "../../middleware/validate";
import * as tasksController from "./tasks.controller";
import { completeTaskSchema, createTaskSchema, listTasksQuerySchema, reviewCompletionSchema } from "./tasks.schemas";

export const tasksRouter = Router();

tasksRouter.use(authenticate);

tasksRouter.post("/", requireRole("PARENT"), validateBody(createTaskSchema), asyncHandler(tasksController.createTask));
tasksRouter.get("/", validateQuery(listTasksQuerySchema), asyncHandler(tasksController.listTasks));
tasksRouter.post(
  "/:id/complete",
  requireRole("CHILD"),
  validateBody(completeTaskSchema),
  asyncHandler(tasksController.completeTask),
);
tasksRouter.post(
  "/:id/completions/:completionId/review",
  requireRole("PARENT"),
  validateBody(reviewCompletionSchema),
  asyncHandler(tasksController.reviewCompletion),
);
