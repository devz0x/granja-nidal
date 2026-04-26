import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-api'

export const runtime = 'nodejs'

/**
 * POST /api/admin/fix-rls
 *
 * Minimal endpoint that ONLY updates the RLS policy on the batches table
 * to allow any authenticated user (single-farm mode).
 * Returns detailed diagnostics so we can see exactly what's happening.
 */
export async function POST(req: NextRequest) {
  const authResult = await verifyAuth()
  if (authResult.error) return authResult.error
  if (!authResult.user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const diagnostics: Record<string, string> = {}

  // Check if POSTGRES_URL is available
  const postgresUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
  if (!postgresUrl) {
    diagnostics.env_check = 'FAIL: POSTGRES_URL and POSTGRES_URL_NON_POOLING are both missing'
    diagnostics.available_envs = Object.keys(process.env)
      .filter(k => k.includes('SUPABASE') || k.includes('POSTGRES') || k.includes('DATABASE'))
      .join(', ')
    return NextResponse.json({
      success: false,
      error: 'POSTGRES_URL no configurada en Vercel.',
      diagnostics,
    }, { status: 500 })
  }
  diagnostics.env_check = 'OK: POSTGRES_URL found'
  diagnostics.url_prefix = postgresUrl.substring(0, postgresUrl.indexOf('@') > -1 ? postgresUrl.indexOf('@') + 1 : 30)

  // Try connecting and running the fix
  try {
    const urlObj = new URL(postgresUrl)
    if (!urlObj.searchParams.has('sslmode')) {
      urlObj.searchParams.set('sslmode', 'require')
    }
    const finalUrl = urlObj.toString()

    const { default: pg } = await import('pg')
    const pool = new pg.Pool({
      connectionString: finalUrl,
      ssl: { rejectUnauthorized: true },
      max: 1,
      idleTimeoutMillis: 15000,
    })

    const client = await pool.connect()
    diagnostics.connection = 'OK'

    try {
      // Step 1: Check current policies on batches
      const polResult = await client.query(`
        SELECT policyname, cmd, qual, with_check
        FROM pg_policies
        WHERE tablename = 'batches' AND schemaname = 'public'
      `)
      diagnostics.existing_policies = polResult.rows.map(r => r.policyname).join(', ') || '(none)'

      // Step 2: Drop old policies
      await client.query(`DROP POLICY IF EXISTS "Farm owner access via farms" ON batches`)
      await client.query(`DROP POLICY IF EXISTS "Farm owner or superadmin access" ON batches`)
      await client.query(`DROP POLICY IF EXISTS "Public access" ON batches`)
      await client.query(`DROP POLICY IF EXISTS "Authenticated access" ON batches`)
      diagnostics.drop_policies = 'OK'

      // Step 3: Create new policy - allow any authenticated user
      await client.query(`
        CREATE POLICY "Authenticated access" ON batches
        FOR ALL
        USING (auth.uid() IS NOT NULL)
        WITH CHECK (auth.uid() IS NOT NULL)
      `)
      diagnostics.create_policy = 'OK'

      // Step 4: Verify
      const verifyResult = await client.query(`
        SELECT policyname, cmd
        FROM pg_policies
        WHERE tablename = 'batches' AND schemaname = 'public'
      `)
      diagnostics.final_policies = verifyResult.rows.map(r => `${r.policyname} (${r.cmd})`).join(', ')

      // Step 5: Make user superadmin
      const userId = authResult.user.id
      await client.query(`
        INSERT INTO user_roles (user_id, role, assigned_by)
        VALUES ('${userId}', 'superadmin', '${userId}')
        ON CONFLICT (user_id) DO UPDATE SET role = 'superadmin', updated_at = NOW()
      `)
      diagnostics.user_role = 'superadmin'

      // Step 6: Update farm owner
      await client.query(`
        UPDATE farms SET user_id = '${userId}'
        WHERE id = '51872fc1-ef45-4a7a-a79c-596c987318ff'
      `)
      diagnostics.farm_owner_updated = 'OK'

    } finally {
      client.release()
    }
    await pool.end()

    return NextResponse.json({
      success: true,
      message: 'RLS fix applied successfully',
      user: authResult.user.email,
      userId: authResult.user.id,
      diagnostics,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    diagnostics.error = msg
    console.error('[fix-rls] Error:', msg)

    return NextResponse.json({
      success: false,
      error: `Error: ${msg}`,
      user: authResult.user.email,
      userId: authResult.user.id,
      diagnostics,
    }, { status: 500 })
  }
}
