import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/admin/clean-all
 *
 * EMERGENCY: Deletes ALL data from ALL tables and ALL auth users.
 * This is a one-time cleanup operation.
 */
export const runtime = 'nodejs'

export async function POST() {
  let postgresUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
  if (!postgresUrl) {
    return NextResponse.json({ error: 'POSTGRES_URL no configurada' }, { status: 500 })
  }

  const urlObj = new URL(postgresUrl)
  urlObj.searchParams.set('sslmode', 'no-verify')
  postgresUrl = urlObj.toString()

  try {
    const { default: pg } = await import('pg')
    const pool = new pg.Pool({
      connectionString: postgresUrl,
      ssl: { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 30000,
    })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Count before
      const tables = ['vaccinations', 'feed_inventory', 'monthly_records', 'structural_expenses', 'reminders', 'daily_entries', 'batches', 'farms', 'audit_log', 'user_roles']
      const before: Record<string, number> = {}
      for (const t of tables) {
        const r = await client.query(`SELECT COUNT(*) as cnt FROM ${t}`)
        before[t] = parseInt(r.rows[0].cnt)
      }
      let beforeUsers = 0
      try {
        const r = await client.query('SELECT COUNT(*) as cnt FROM auth.users')
        beforeUsers = parseInt(r.rows[0].cnt)
      } catch { /* */ }

      // Delete all data (children first, then parents)
      for (const t of tables) {
        await client.query(`DELETE FROM ${t}`)
      }

      // Delete all auth users
      await client.query('DELETE FROM auth.users')

      // Count after
      const after: Record<string, number> = {}
      for (const t of tables) {
        const r = await client.query(`SELECT COUNT(*) as cnt FROM ${t}`)
        after[t] = parseInt(r.rows[0].cnt)
      }
      let afterUsers = 0
      try {
        const r = await client.query('SELECT COUNT(*) as cnt FROM auth.users')
        afterUsers = parseInt(r.rows[0].cnt)
      } catch { /* */ }

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Base de datos limpiada completamente',
        before: { ...before, auth_users: beforeUsers },
        after: { ...after, auth_users: afterUsers },
      })
    } catch (txError) {
      await client.query('ROLLBACK')
      throw txError
    } finally {
      client.release()
    }
    await pool.end()
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Clean-all error:', msg)
    return NextResponse.json({ error: `Error: ${msg}` }, { status: 500 })
  }
}
