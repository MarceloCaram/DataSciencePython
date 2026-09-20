import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient instance across the app (and across hot
// reloads in dev) to avoid exhausting Postgres connections.
declare global {
  // eslint-disable-next-line no-var
  var __mingalbankPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__mingalbankPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__mingalbankPrisma = prisma;
}
