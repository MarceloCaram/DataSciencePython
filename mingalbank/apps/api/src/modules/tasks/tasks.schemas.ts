import { z } from "zod";

export const taskCategoryEnum = z.enum(["HEALTH", "STUDY", "HOME", "CREATIVITY"]);
export const taskCompletionStatusEnum = z.enum(["PENDING", "APPROVED", "REJECTED"]);

export const createTaskSchema = z.object({
  childId: z.string().min(1, "childId é obrigatório"),
  title: z.string().trim().min(1, "title é obrigatório"),
  category: taskCategoryEnum,
  points: z.coerce.number().int().positive("points deve ser positivo"),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const listTasksQuerySchema = z.object({
  childId: z.string().min(1).optional(),
  status: taskCompletionStatusEnum.optional(),
});
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

export const completeTaskSchema = z.object({
  evidenceUrl: z.string().url().optional(),
});
export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;

export const reviewCompletionSchema = z.object({
  approve: z.boolean({ required_error: "approve é obrigatório" }),
});
export type ReviewCompletionInput = z.infer<typeof reviewCompletionSchema>;
