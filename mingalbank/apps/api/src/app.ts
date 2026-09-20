import cors from "cors";
import express, { type Express } from "express";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/auth.routes";
import { childrenRouter } from "./modules/children/children.routes";
import { tasksRouter } from "./modules/tasks/tasks.routes";
import { walletRouter } from "./modules/wallet/wallet.routes";
import { rewardsRouter } from "./modules/rewards/rewards.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  const v1 = express.Router();
  v1.use("/auth", authRouter);
  v1.use("/children", childrenRouter);
  v1.use("/tasks", tasksRouter);
  v1.use("/wallet", walletRouter);
  v1.use("/rewards", rewardsRouter);
  v1.use("/dashboard", dashboardRouter);

  app.use("/api/v1", v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
