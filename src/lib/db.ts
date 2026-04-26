// ================================================================
// SECURITY FIX VULN-20: Removed Prisma query logging
// This file is LEGACY and not used in production (Supabase is the DB)
// ================================================================

const globalForPrisma = globalThis as unknown as {
  prisma: any
}

export const db =
  globalForPrisma.prisma ??
  null as unknown as any // No Prisma client in production

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
