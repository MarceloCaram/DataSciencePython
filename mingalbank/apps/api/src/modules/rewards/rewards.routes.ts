import { Router } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { authenticate, requireRole } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import * as rewardsController from "./rewards.controller";
import { createRewardSchema } from "./rewards.schemas";

export const rewardsRouter = Router();

rewardsRouter.use(authenticate);

rewardsRouter.post("/", requireRole("PARENT"), validateBody(createRewardSchema), asyncHandler(rewardsController.createReward));
rewardsRouter.get("/", asyncHandler(rewardsController.listRewards));
rewardsRouter.post("/:id/claim", requireRole("CHILD"), asyncHandler(rewardsController.claimReward));
