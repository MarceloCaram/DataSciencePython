import { z } from "zod";

export const updateFamilySettingsSchema = z.object({
  weekendMultiplier: z.coerce
    .number()
    .min(1, "weekendMultiplier deve ser no mínimo 1 (sem redução de pontos)")
    .max(3, "weekendMultiplier deve ser no máximo 3"),
});
export type UpdateFamilySettingsInput = z.infer<typeof updateFamilySettingsSchema>;
