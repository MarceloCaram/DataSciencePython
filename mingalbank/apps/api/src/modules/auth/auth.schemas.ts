import { z } from "zod";

export const registerParentSchema = z.object({
  familyName: z.string().trim().min(1, "familyName é obrigatório"),
  parentName: z.string().trim().min(1, "parentName é obrigatório"),
  email: z.string().trim().toLowerCase().email("email inválido"),
  password: z.string().min(8, "password deve ter ao menos 8 caracteres"),
});
export type RegisterParentInput = z.infer<typeof registerParentSchema>;

export const loginParentSchema = z.object({
  email: z.string().trim().toLowerCase().email("email inválido"),
  password: z.string().min(1, "password é obrigatório"),
});
export type LoginParentInput = z.infer<typeof loginParentSchema>;

export const loginChildSchema = z.object({
  childId: z.string().min(1, "childId é obrigatório"),
  pin: z
    .string()
    .min(4, "pin deve ter ao menos 4 dígitos")
    .max(8, "pin deve ter no máximo 8 dígitos"),
});
export type LoginChildInput = z.infer<typeof loginChildSchema>;

export const setChildPinSchema = z.object({
  childId: z.string().min(1, "childId é obrigatório"),
  pin: z
    .string()
    .min(4, "pin deve ter ao menos 4 dígitos")
    .max(8, "pin deve ter no máximo 8 dígitos"),
});
export type SetChildPinInput = z.infer<typeof setChildPinSchema>;
