import { z } from "zod";

export const allowancePeriodEnum = z.enum(["WEEKLY", "MONTHLY"]);

export const createChildSchema = z.object({
  name: z.string().trim().min(1, "name é obrigatório"),
  birthDate: z.coerce.date({ errorMap: () => ({ message: "birthDate inválida" }) }),
  photoUrl: z.string().url().optional(),
  trustLevel: z.coerce.number().int().min(1).max(5).default(1),
  allowanceValue: z.coerce.number().nonnegative("allowanceValue deve ser >= 0"),
  allowancePeriod: allowancePeriodEnum,
});
export type CreateChildInput = z.infer<typeof createChildSchema>;

export const updateChildSchema = z
  .object({
    allowanceValue: z.coerce.number().nonnegative().optional(),
    allowancePeriod: allowancePeriodEnum.optional(),
    trustLevel: z.coerce.number().int().min(1).max(5).optional(),
    name: z.string().trim().min(1).optional(),
    photoUrl: z.string().url().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Informe ao menos um campo para atualizar" });
export type UpdateChildInput = z.infer<typeof updateChildSchema>;
