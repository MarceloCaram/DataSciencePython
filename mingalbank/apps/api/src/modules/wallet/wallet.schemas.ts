import { z } from "zod";

export const redeemSchema = z.object({
  points: z.coerce.number().int().positive("points deve ser positivo"),
});
export type RedeemInput = z.infer<typeof redeemSchema>;

export const reviewRedemptionSchema = z.object({
  approve: z.boolean({ required_error: "approve é obrigatório" }),
});
export type ReviewRedemptionInput = z.infer<typeof reviewRedemptionSchema>;
