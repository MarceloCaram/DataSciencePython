import { Router } from "express";
import { asyncHandler } from "../../middleware/errorHandler";
import { authenticate, requireRole } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import * as walletController from "./wallet.controller";
import { redeemSchema, reviewRedemptionSchema } from "./wallet.schemas";

export const walletRouter = Router();

walletRouter.use(authenticate);

// Must be declared before "/:childId" routes so "redemptions" isn't captured as :childId.
walletRouter.post(
  "/redemptions/:id/review",
  requireRole("PARENT"),
  validateBody(reviewRedemptionSchema),
  asyncHandler(walletController.reviewRedemption),
);

walletRouter.get("/:childId", asyncHandler(walletController.getWalletSummary));
walletRouter.get("/:childId/transactions", asyncHandler(walletController.getWalletTransactions));
walletRouter.post(
  "/:childId/redeem",
  requireRole("CHILD"),
  validateBody(redeemSchema),
  asyncHandler(walletController.requestRedemption),
);
