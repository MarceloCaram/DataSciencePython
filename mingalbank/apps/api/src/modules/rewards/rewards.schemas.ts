import { z } from "zod";

export const rewardTypeEnum = z.enum(["PRIVILEGE", "CASH"]);

export const createRewardSchema = z.object({
  title: z.string().trim().min(1, "title é obrigatório"),
  type: rewardTypeEnum,
  pointsCost: z.coerce.number().int().positive("pointsCost deve ser positivo"),
  cashValue: z.coerce.number().nonnegative().optional(),
});
export type CreateRewardInput = z.infer<typeof createRewardSchema>;
