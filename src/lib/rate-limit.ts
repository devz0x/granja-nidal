// ================================================================
// Simple in-memory rate limiter for API routes and middleware
// Works per-instance (sufficient for Vercel serverless)
// For production-scale, use Upstash Redis or similar distributed store
// ================================================================

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key)
    }
    lastCleanup = now
  }
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

/**
 * Check rate limit for a given identifier (usually IP or IP+endpoint).
 * @param key - Unique identifier (e.g., "ip" or "ip:/api/auth/login")
 * @param maxRequests - Max requests in the window
 * @param windowMs - Time window in milliseconds
 */
export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number = 15 * 60 * 1000 // 15 minutes default
): RateLimitResult {
  cleanup()

  const now = Date.now()
  const existing = store.get(key)

  if (!existing || now > existing.resetAt) {
    // New window
    const resetAt = now + windowMs
    store.set(key, { count: 1, resetAt })
    return { success: true, remaining: maxRequests - 1, resetAt }
  }

  if (existing.count >= maxRequests) {
    return { success: false, remaining: 0, resetAt: existing.resetAt }
  }

  existing.count++
  return { success: true, remaining: maxRequests - existing.count, resetAt: existing.resetAt }
}

// Pre-configured limiters
export const loginRateLimit = (key: string) => rateLimit(`login:${key}`, 5, 15 * 60 * 1000) // 5 per 15 min
export const changePasswordRateLimit = (key: string) => rateLimit(`chpwd:${key}`, 3, 15 * 60 * 1000) // 3 per 15 min
export const apiRateLimit = (key: string) => rateLimit(`api:${key}`, 100, 60 * 1000) // 100 per minute
export const setupRateLimit = (key: string) => rateLimit(`setup:${key}`, 1, 60 * 60 * 1000) // 1 per hour
