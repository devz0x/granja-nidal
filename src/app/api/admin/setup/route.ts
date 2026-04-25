import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-api'

export const runtime = 'nodejs'

/**
 * POST /api/admin/setup
 *
 * Setup endpoint that creates user_roles and audit_log tables,
 * triggers, functions, and RLS policies in Supabase.
 *
 * Requires: POSTGRES_URL env var (auto-set by Supabase Vercel integration)
 * Security: Only authenticated users can run this
 */
export async function POST(req: NextRequest) {
  const { user, error: authError } = await verifyAuth()
  if (authError) return authError

  const postgresUrl = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING
  if (!postgresUrl) {
    return NextResponse.json(
      { error: 'POSTGRES_URL no configurada. La integracion Supabase-Vercel debe estar activa.' },
      { status: 500 }
    )
  }

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
      await client.query(MIGRATION_SQL)
      await client.query('COMMIT')
    } catch (txError) {
      await client.query('ROLLBACK')
      throw txError
    } finally {
      client.release()
    }
    await pool.end()

    return NextResponse.json({
      success: true,
      message: 'Migracion ejecutada exitosamente. Tablas user_roles y audit_log creadas.',
      user: user?.email,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Migration error:', msg)
    return NextResponse.json({ error: `Error en migracion: ${msg}` }, { status: 500 })
  }
}

export async function GET() {
  const postgresUrl = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING
  if (!postgresUrl) {
    return NextResponse.json({ configured: false, message: 'POSTGRES_URL no configurada' })
  }
  try {
    const { default: pg } = await import('pg')
    const pool = new pg.Pool({ connectionString: postgresUrl, ssl: { rejectUnauthorized: false }, max: 1 })
    const result = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_roles') as setup"
    )
    await pool.end()
    return NextResponse.json({ configured: true, isSetup: result.rows[0]?.setup || false })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Setup check error:', msg)
    return NextResponse.json({ configured: true, isSetup: false, error: msg })
  }
}

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('superadmin', 'user')),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[] DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_role TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_operation ON audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON audit_log(record_id);

CREATE OR REPLACE FUNCTION is_superadmin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM user_roles WHERE user_id = check_user_id AND role = 'superadmin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
BEGIN
  IF is_superadmin(auth.uid()) THEN RETURN 'superadmin'; END IF;
  RETURN 'user';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION current_user_email()
RETURNS TEXT AS $$
  SELECT raw_user_email FROM auth.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_old_data JSONB;
  v_new_data JSONB;
  v_changed TEXT[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new_data := to_jsonb(NEW);
    v_changed := ARRAY(SELECT jsonb_object_keys(v_new_data));
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_changed := ARRAY(SELECT key FROM jsonb_each(to_jsonb(NEW)) WHERE to_jsonb(NEW)->key IS DISTINCT FROM to_jsonb(OLD)->key);
  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_changed := ARRAY(SELECT jsonb_object_keys(v_old_data));
  END IF;
  INSERT INTO audit_log (table_name, operation, record_id, old_data, new_data, changed_fields, user_id, user_email, user_role)
  VALUES (TG_TABLE_NAME, TG_OP, COALESCE(NEW.id, OLD.id), v_old_data, v_new_data, COALESCE(v_changed, '{}'), auth.uid(), current_user_email(), current_user_role());
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_farms_trigger ON farms;
DROP TRIGGER IF EXISTS audit_batches_trigger ON batches;
DROP TRIGGER IF EXISTS audit_daily_entries_trigger ON daily_entries;
DROP TRIGGER IF EXISTS audit_reminders_trigger ON reminders;
DROP TRIGGER IF EXISTS audit_structural_expenses_trigger ON structural_expenses;
DROP TRIGGER IF EXISTS audit_monthly_records_trigger ON monthly_records;
DROP TRIGGER IF EXISTS audit_feed_inventory_trigger ON feed_inventory;
DROP TRIGGER IF EXISTS audit_vaccinations_trigger ON vaccinations;
DROP TRIGGER IF EXISTS audit_user_roles_trigger ON user_roles;
CREATE TRIGGER audit_farms_trigger AFTER INSERT OR UPDATE OR DELETE ON farms FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER audit_batches_trigger AFTER INSERT OR UPDATE OR DELETE ON batches FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER audit_daily_entries_trigger AFTER INSERT OR UPDATE OR DELETE ON daily_entries FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER audit_reminders_trigger AFTER INSERT OR UPDATE OR DELETE ON reminders FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER audit_structural_expenses_trigger AFTER INSERT OR UPDATE OR DELETE ON structural_expenses FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER audit_monthly_records_trigger AFTER INSERT OR UPDATE OR DELETE ON monthly_records FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER audit_feed_inventory_trigger AFTER INSERT OR UPDATE OR DELETE ON feed_inventory FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER audit_vaccinations_trigger AFTER INSERT OR UPDATE OR DELETE ON vaccinations FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER audit_user_roles_trigger AFTER INSERT OR UPDATE OR DELETE ON user_roles FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Superadmins can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Superadmins can update roles" ON user_roles;
DROP POLICY IF EXISTS "Superadmins can delete roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON user_roles;
CREATE POLICY "Superadmins can view all roles" ON user_roles FOR SELECT USING (is_superadmin(auth.uid()));
CREATE POLICY "Superadmins can insert roles" ON user_roles FOR INSERT WITH CHECK (is_superadmin(auth.uid()));
CREATE POLICY "Superadmins can update roles" ON user_roles FOR UPDATE USING (is_superadmin(auth.uid())) WITH CHECK (is_superadmin(auth.uid()));
CREATE POLICY "Superadmins can delete roles" ON user_roles FOR DELETE USING (is_superadmin(auth.uid()));
CREATE POLICY "Users can view own role" ON user_roles FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Only superadmins can view audit log" ON audit_log;
DROP POLICY IF EXISTS "No direct writes to audit_log" ON audit_log;
DROP POLICY IF EXISTS "No direct updates to audit_log" ON audit_log;
DROP POLICY IF EXISTS "No direct deletes to audit_log" ON audit_log;
CREATE POLICY "Only superadmins can view audit log" ON audit_log FOR SELECT USING (is_superadmin(auth.uid()));
CREATE POLICY "No direct writes to audit_log" ON audit_log FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct updates to audit_log" ON audit_log FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "No direct deletes to audit_log" ON audit_log FOR DELETE USING (false);

DROP POLICY IF EXISTS "Users can manage their own farms" ON farms;
DROP POLICY IF EXISTS "Users can insert their own farms" ON farms;
CREATE POLICY "Users can manage their own farms" ON farms FOR ALL USING (auth.uid() = user_id OR is_superadmin(auth.uid())) WITH CHECK (auth.uid() = user_id OR is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Farm owner access via farms" ON batches;
DROP POLICY IF EXISTS "Farm owner or superadmin access" ON batches;
CREATE POLICY "Farm owner or superadmin access" ON batches FOR ALL USING (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid())) WITH CHECK (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Farm owner access via farms" ON daily_entries;
DROP POLICY IF EXISTS "Farm owner or superadmin access" ON daily_entries;
CREATE POLICY "Farm owner or superadmin access" ON daily_entries FOR ALL USING (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid())) WITH CHECK (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Farm owner access via farms" ON reminders;
DROP POLICY IF EXISTS "Farm owner or superadmin access" ON reminders;
CREATE POLICY "Farm owner or superadmin access" ON reminders FOR ALL USING (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid())) WITH CHECK (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Farm owner access via farms" ON structural_expenses;
DROP POLICY IF EXISTS "Farm owner or superadmin access" ON structural_expenses;
CREATE POLICY "Farm owner or superadmin access" ON structural_expenses FOR ALL USING (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid())) WITH CHECK (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Farm owner access via farms" ON monthly_records;
DROP POLICY IF EXISTS "Farm owner or superadmin access" ON monthly_records;
CREATE POLICY "Farm owner or superadmin access" ON monthly_records FOR ALL USING (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid())) WITH CHECK (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Farm owner access via farms" ON feed_inventory;
DROP POLICY IF EXISTS "Farm owner or superadmin access" ON feed_inventory;
CREATE POLICY "Farm owner or superadmin access" ON feed_inventory FOR ALL USING (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid())) WITH CHECK (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Farm owner access via farms" ON vaccinations;
DROP POLICY IF EXISTS "Farm owner or superadmin access" ON vaccinations;
CREATE POLICY "Farm owner or superadmin access" ON vaccinations FOR ALL USING (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid())) WITH CHECK (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid()));

INSERT INTO user_roles (user_id, role, assigned_by)
SELECT id, 'superadmin', id FROM auth.users WHERE id NOT IN (SELECT user_id FROM user_roles) LIMIT 1
ON CONFLICT (user_id) DO NOTHING;
`
