import { Router } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { authenticate, requireRole } from "../../middleware/auth";
import * as dashboardController from "./dashboard.controller";

export const dashboardRouter = Router();

dashboardRouter.get("/", authenticate, requireRole("PARENT"), asyncHandler(dashboardController.getDashboard));
