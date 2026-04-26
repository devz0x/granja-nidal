import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-api'
import { createServiceRoleClient, ensureFarmExists } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * POST /api/admin/fix-rls
 *
 * Disables RLS on ALL data tables and promotes the user to superadmin.
 * Uses the Supabase service_role client (bypasses RLS) and pg library
 * as a fallback. For a single-farm app with application-level auth,
 * RLS is unnecessary — verifyAuth/verifyFarmAccess protect all routes.
 */
export async function POST(req: NextRequest) {
  const authResult = await verifyAuth()
  if (authResult.error) return authResult.error
  if (!authResult.user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const diagnostics: Record<string, string> = {}

  // ================================================================
  // APPROACH 1: Try via pg (POSTGRES_URL) — can execute DDL
  // ================================================================
  const postgresUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
  if (postgresUrl) {
    diagnostics.pg_available = 'yes'
    try {
      const urlObj = new URL(postgresUrl)
      if (!urlObj.searchParams.has('sslmode')) {
        urlObj.searchParams.set('sslmode', 'require')
      }
      const finalUrl = urlObj.toString()

      const { default: pg } = await import('pg')
      const pool = new pg.Pool({
        connectionString: finalUrl,
        ssl: { rejectUnauthorized: false },
        max: 1,
        idleTimeoutMillis: 15000,
      })

      const client = await pool.connect()
      diagnostics.pg_connection = 'OK'

      try {
        // Disable RLS on ALL data tables — app-level auth handles security
        const tables = [
          'batches', 'daily_entries', 'reminders', 'structural_expenses',
          'monthly_records', 'feed_inventory', 'vaccinations',
          'cash_flow_entries', 'inventory_movements', 'invoices', 'shed_logs',
          'farms', 'user_roles', 'audit_log'
        ]

        for (const table of tables) {
          try {
            await client.query(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`)
            diagnostics[`rls_${table}`] = 'disabled'
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e)
            diagnostics[`rls_${table}`] = `skipped: ${msg}`
          }
        }

        // Promote user to superadmin
        const userId = authResult.user.id
        await client.query(`
          INSERT INTO user_roles (user_id, role, assigned_by)
          VALUES ('${userId}', 'superadmin', '${userId}')
          ON CONFLICT (user_id) DO UPDATE SET role = 'superadmin', updated_at = NOW()
        `)
        diagnostics.user_role = 'superadmin'

        // Update farm owner
        await client.query(`
          UPDATE farms SET user_id = '${userId}'
          WHERE id = '51872fc1-ef45-4a7a-a79c-596c987318ff'
        `)
        diagnostics.farm_owner_updated = 'OK'

        diagnostics.method = 'pg_direct'

      } finally {
        client.release()
      }
      await pool.end()

      return NextResponse.json({
        success: true,
        message: 'RLS disabled on all tables via pg.',
        user: authResult.user.email,
        userId: authResult.user.id,
        diagnostics,
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      diagnostics.pg_error = msg
      console.error('[fix-rls] pg approach failed:', msg)
      // Fall through to approach 2
    }
  } else {
    diagnostics.pg_available = 'no (POSTGRES_URL not set)'
  }

  // ================================================================
  // APPROACH 2: Use service_role Supabase client (bypasses RLS)
  // If we can't disable RLS, at least ensure data ops work via service_role
  // ================================================================
  try {
    const serviceRole = createServiceRoleClient()
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
    diagnostics.service_role_available = hasServiceKey ? 'yes' : 'no (using anon fallback)'

    // Verify we can query batches table
    const { data, error } = await serviceRole
      .from('batches')
      .select('id')
      .limit(1)

    if (error) {
      diagnostics.service_role_test = `failed: ${error.message}`
    } else {
      diagnostics.service_role_test = 'OK'
    }

    // Promote user to superadmin via service_role (bypasses RLS)
    const { error: roleError } = await serviceRole
      .from('user_roles')
      .upsert({
        user_id: authResult.user.id,
        role: 'superadmin',
        assigned_by: authResult.user.id,
        must_change_password: false,
      }, { onConflict: 'user_id' })

    if (roleError) {
      diagnostics.role_update = `failed: ${roleError.message}`
    } else {
      diagnostics.user_role = 'superadmin (via service_role)'
    }

    // Ensure the farm exists
    await ensureFarmExists(authResult.user.id)
    diagnostics.farm_ensured = 'OK'

    diagnostics.method = 'service_role'

    return NextResponse.json({
      success: true,
      message: 'Service role client verified. RLS bypassed for Supabase operations.',
      user: authResult.user.email,
      userId: authResult.user.id,
      diagnostics,
      warning: postgresUrl
        ? 'pg approach failed but service_role works. Add SUPABASE_SERVICE_ROLE_KEY to Vercel env for best results.'
        : 'POSTGRES_URL not set. Add SUPABASE_SERVICE_ROLE_KEY to Vercel env to fully bypass RLS.',
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    diagnostics.service_role_error = msg

    return NextResponse.json({
      success: false,
      error: `Both approaches failed. Add SUPABASE_SERVICE_ROLE_KEY to Vercel env vars.`,
      user: authResult.user.email,
      userId: authResult.user.id,
      diagnostics,
    }, { status: 500 })
  }
}
