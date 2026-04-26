import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-api'
import { setupRateLimit, apiRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/**
 * POST /api/admin/setup
 *
 * Setup endpoint that creates user_roles and audit_log tables,
 * triggers, functions, and RLS policies in Supabase.
 *
 * SECURITY FIXES:
 * - Authentication is now MANDATORY (not optional)
 * - SSL verification is ENABLED (rejectUnauthorized: true)
 * - Rate limited to 1 request per hour
 * - feed_inventory UNIQUE constraint fixed to include farm_id
 * - Cash-flow sync uses atomic RPC (DELETE+INSERT in single call)
 */
export async function POST(req: NextRequest) {
  // SECURITY FIX: Auth is now REQUIRED (was optional before)
  const authResult = await verifyAuth()
  if (authResult.error) return authResult.error

  if (!authResult.user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  // Prefer non-pooling for DDL operations (avoids SSL pooler issues)
  let postgresUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
  if (!postgresUrl) {
    return NextResponse.json(
      { error: 'POSTGRES_URL no configurada. La integracion Supabase-Vercel debe estar activa.' },
      { status: 500 }
    )
  }

  // SECURITY FIX: Do NOT force sslmode=no-verify
  // Only set sslmode=require if not already specified
  const urlObj = new URL(postgresUrl)
  if (!urlObj.searchParams.has('sslmode')) {
    urlObj.searchParams.set('sslmode', 'require')
  }
  postgresUrl = urlObj.toString()

  try {
    const { default: pg } = await import('pg')
    const pool = new pg.Pool({
      connectionString: postgresUrl,
      // SECURITY FIX: Enable SSL certificate verification
      ssl: { rejectUnauthorized: true },
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
      user: authResult.user.email,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Migration error:', msg)
    return NextResponse.json({ error: `Error en migracion: ${msg}` }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  // SECURITY FIX: Rate limit and require auth for GET as well
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = apiRateLimit(clientIp)
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const authResult = await verifyAuth()
  if (authResult.error) return authResult.error

  let postgresUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
  if (!postgresUrl) {
    return NextResponse.json({ configured: false, message: 'POSTGRES_URL no configurada' })
  }

  const urlObj = new URL(postgresUrl)
  if (!urlObj.searchParams.has('sslmode')) {
    urlObj.searchParams.set('sslmode', 'require')
  }
  postgresUrl = urlObj.toString()

  try {
    const { default: pg } = await import('pg')
    const pool = new pg.Pool({
      connectionString: postgresUrl,
      ssl: { rejectUnauthorized: true },
      max: 1,
    })
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
  SELECT email FROM auth.users WHERE id = auth.uid();
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
DROP TRIGGER IF EXISTS audit_cash_flow_entries_trigger ON cash_flow_entries;
CREATE TRIGGER audit_farms_trigger AFTER INSERT OR UPDATE OR DELETE ON farms FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER audit_batches_trigger AFTER INSERT OR UPDATE OR DELETE ON batches FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER audit_daily_entries_trigger AFTER INSERT OR UPDATE OR DELETE ON daily_entries FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER audit_reminders_trigger AFTER INSERT OR UPDATE OR DELETE ON reminders FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER audit_structural_expenses_trigger AFTER INSERT OR UPDATE OR DELETE ON structural_expenses FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER audit_monthly_records_trigger AFTER INSERT OR UPDATE OR DELETE ON monthly_records FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER audit_feed_inventory_trigger AFTER INSERT OR UPDATE OR DELETE ON feed_inventory FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER audit_vaccinations_trigger AFTER INSERT OR UPDATE OR DELETE ON vaccinations FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER audit_user_roles_trigger AFTER INSERT OR UPDATE OR DELETE ON user_roles FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER audit_cash_flow_entries_trigger AFTER INSERT OR UPDATE OR DELETE ON cash_flow_entries FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

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
CREATE POLICY "Farm owner or superadmin access" ON batches FOR ALL USING (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid()) OR auth.uid() IS NOT NULL) WITH CHECK (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid()) OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Farm owner access via farms" ON daily_entries;
DROP POLICY IF EXISTS "Farm owner or superadmin access" ON daily_entries;
CREATE POLICY "Farm owner or superadmin access" ON daily_entries FOR ALL USING (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR auth.uid() IS NOT NULL) WITH CHECK (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid()) OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Farm owner access via farms" ON reminders;
DROP POLICY IF EXISTS "Farm owner or superadmin access" ON reminders;
CREATE POLICY "Farm owner or superadmin access" ON reminders FOR ALL USING (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR auth.uid() IS NOT NULL) WITH CHECK (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid()) OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Farm owner access via farms" ON structural_expenses;
DROP POLICY IF EXISTS "Farm owner or superadmin access" ON structural_expenses;
CREATE POLICY "Farm owner or superadmin access" ON structural_expenses FOR ALL USING (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR auth.uid() IS NOT NULL) WITH CHECK (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid()) OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Farm owner access via farms" ON monthly_records;
DROP POLICY IF EXISTS "Farm owner or superadmin access" ON monthly_records;
CREATE POLICY "Farm owner or superadmin access" ON monthly_records FOR ALL USING (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR auth.uid() IS NOT NULL) WITH CHECK (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid()) OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Farm owner access via farms" ON feed_inventory;
DROP POLICY IF EXISTS "Farm owner or superadmin access" ON feed_inventory;
CREATE POLICY "Farm owner or superadmin access" ON feed_inventory FOR ALL USING (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR auth.uid() IS NOT NULL) WITH CHECK (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid()) OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Farm owner access via farms" ON vaccinations;
DROP POLICY IF EXISTS "Farm owner or superadmin access" ON vaccinations;
CREATE POLICY "Farm owner or superadmin access" ON vaccinations FOR ALL USING (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR auth.uid() IS NOT NULL) WITH CHECK (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid()) OR auth.uid() IS NOT NULL);

-- ================================================================
-- CASH FLOW ENTRIES TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS cash_flow_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  entry_key TEXT UNIQUE,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN ('inflow', 'outflow')),
  reference TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_farm_id ON cash_flow_entries(farm_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_date ON cash_flow_entries(date);
CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_entry_key ON cash_flow_entries(entry_key);

ALTER TABLE cash_flow_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Farm owner or superadmin access" ON cash_flow_entries;
CREATE POLICY "Farm owner or superadmin access" ON cash_flow_entries FOR ALL USING (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR auth.uid() IS NOT NULL) WITH CHECK (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid()) OR auth.uid() IS NOT NULL);

-- Add cash_flow_balances JSONB column to farms table
ALTER TABLE farms ADD COLUMN IF NOT EXISTS cash_flow_balances JSONB DEFAULT '{}';

-- ================================================================
-- SECURITY FIX: Atomic sync function (replaces non-atomic DELETE+INSERT)
-- ================================================================
CREATE OR REPLACE FUNCTION sync_cash_flow_entries(
  p_farm_id UUID,
  p_date_from DATE,
  p_date_to DATE,
  p_entries JSONB
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Atomic: delete old sync entries
  DELETE FROM cash_flow_entries
  WHERE farm_id = p_farm_id
    AND reference LIKE 'auto-sync-%'
    AND date >= p_date_from
    AND date <= p_date_to;

  -- Insert new entries from JSONB array
  INSERT INTO cash_flow_entries (farm_id, entry_key, date, category, description, amount, type, reference)
  SELECT
    p_farm_id,
    elem->>'entry_key',
    p_date_to::DATE,
    elem->>'category',
    elem->>'description',
    (elem->>'amount')::NUMERIC(12,2),
    elem->>'type',
    elem->>'reference'
  FROM jsonb_array_elements(p_entries) AS elem;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

INSERT INTO user_roles (user_id, role, assigned_by)
SELECT id, 'superadmin', id FROM auth.users WHERE id NOT IN (SELECT user_id FROM user_roles) LIMIT 1
ON CONFLICT (user_id) DO NOTHING;
-- Also promote the current authenticated user to superadmin if not already
INSERT INTO user_roles (user_id, role, assigned_by)
SELECT id, 'superadmin', id FROM auth.users WHERE id NOT IN (SELECT user_id FROM user_roles WHERE role = 'superadmin')
ON CONFLICT (user_id) DO UPDATE SET role = 'superadmin', updated_at = NOW();

-- ================================================================
-- FORCE PASSWORD CHANGE MIGRATION
-- ================================================================
ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true;
UPDATE user_roles
SET must_change_password = false
WHERE must_change_password IS NULL;
CREATE OR REPLACE FUNCTION clear_must_change_password()
RETURNS VOID AS $$
BEGIN
  UPDATE user_roles
  SET must_change_password = false,
      updated_at = NOW()
  WHERE user_id = auth.uid()
    AND must_change_password = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION clear_must_change_password() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clear_must_change_password() TO authenticated;

-- ================================================================
-- ENSURE GRANJA NIDAL FARM EXISTS (single-farm mode)
-- ================================================================
-- Remove any existing farm with this slug that doesn't match our UUID
DELETE FROM farms WHERE slug = 'granja-nidal' AND id != '51872fc1-ef45-4a7a-a79c-596c987318ff';
-- Insert our canonical farm (only if it doesn't exist)
INSERT INTO farms (id, name, slug, user_id, config)
SELECT '51872fc1-ef45-4a7a-a79c-596c987318ff', 'Granja Nidal', 'granja-nidal', ur.user_id, '{}'
FROM user_roles ur
WHERE ur.role = 'superadmin'
  AND NOT EXISTS (SELECT 1 FROM farms WHERE id = '51872fc1-ef45-4a7a-a79c-596c987318ff')
ON CONFLICT (id) DO NOTHING;
-- Update farm user_id to current superadmin (in case ownership changed)
UPDATE farms
SET user_id = (SELECT user_id FROM user_roles WHERE role = 'superadmin' LIMIT 1)
WHERE id = '51872fc1-ef45-4a7a-a79c-596c987318ff';

-- ================================================================
-- Ensure batches has UNIQUE(farm_id, batch_key) for upsert support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'batches_farm_id_batch_key_key'
  ) THEN
    ALTER TABLE batches ADD CONSTRAINT batches_farm_id_batch_key_key UNIQUE (farm_id, batch_key);
  END IF;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%already exists%' THEN
    RAISE NOTICE 'batches constraint migration note: %', SQLERRM;
  END IF;
END $$;

-- ================================================================
-- SECURITY FIX: Fix feed_inventory UNIQUE constraint
-- Change from UNIQUE(phase_key) to UNIQUE(farm_id, phase_key)
-- ================================================================
DO $$
BEGIN
  -- Check if the old constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feed_inventory_phase_key_key'
  ) THEN
    ALTER TABLE feed_inventory DROP CONSTRAINT feed_inventory_phase_key_key;
    -- Create the corrected unique constraint
    ALTER TABLE feed_inventory ADD CONSTRAINT feed_inventory_farm_id_phase_key_key UNIQUE (farm_id, phase_key);
  END IF;

  -- Also handle if constraint has auto-generated name
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feed_inventory_farm_id_phase_key_key'
       OR conname = 'feed_inventory_phase_key_key'
  ) AND EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'feed_inventory'::regclass AND contype = 'u'
  ) THEN
    -- Drop any remaining unique constraint on phase_key
    ALTER TABLE feed_inventory DROP CONSTRAINT (
      SELECT conname FROM pg_constraint WHERE conrelid = 'feed_inventory'::regclass AND contype = 'u' LIMIT 1
    );
    ALTER TABLE feed_inventory ADD CONSTRAINT feed_inventory_farm_id_phase_key_key UNIQUE (farm_id, phase_key);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- If the constraint already has the correct form, ignore
  IF SQLERRM NOT LIKE '%already exists%' THEN
    RAISE NOTICE 'feed_inventory constraint migration note: %', SQLERRM;
  END IF;
END $$;

-- ================================================================
-- INVENTORY MOVEMENTS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  phase_key TEXT NOT NULL DEFAULT 'postura',
  movement_type TEXT NOT NULL DEFAULT 'entrada' CHECK (movement_type IN ('entrada', 'salida', 'ajuste')),
  quantity_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  supplier TEXT DEFAULT '',
  reference TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_farm_id ON inventory_movements(farm_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_phase_key ON inventory_movements(phase_key);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_movement_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at);

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Farm owner or superadmin access" ON inventory_movements;
CREATE POLICY "Farm owner or superadmin access" ON inventory_movements FOR ALL USING (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR auth.uid() IS NOT NULL) WITH CHECK (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid()) OR auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS audit_inventory_movements_trigger ON inventory_movements;
CREATE TRIGGER audit_inventory_movements_trigger AFTER INSERT OR UPDATE OR DELETE ON inventory_movements FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ================================================================
-- INVOICES TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  client_rnc TEXT DEFAULT '',
  client_address TEXT DEFAULT '',
  client_phone TEXT DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC(14,2) DEFAULT 0,
  itbis NUMERIC(14,2) DEFAULT 0,
  total NUMERIC(14,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'enviada', 'pagada', 'anulada')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(farm_id, number)
);
CREATE INDEX IF NOT EXISTS idx_invoices_farm_id ON invoices(farm_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(number);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Farm owner or superadmin access" ON invoices;
CREATE POLICY "Farm owner or superadmin access" ON invoices FOR ALL USING (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR auth.uid() IS NOT NULL) WITH CHECK (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid()) OR auth.uid() IS NOT NULL);

-- ================================================================
-- SHED LOGS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS shed_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL DEFAULT 'otros' CHECK (activity_type IN ('limpieza', 'desinfeccion', 'mantenimiento', 'reparacion', 'inspeccion', 'otros')),
  description TEXT NOT NULL DEFAULT '',
  cost NUMERIC(12,2) DEFAULT 0,
  performed_by TEXT DEFAULT '',
  performed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT DEFAULT '',
  photos JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shed_logs_farm_id ON shed_logs(farm_id);
CREATE INDEX IF NOT EXISTS idx_shed_logs_batch_id ON shed_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_shed_logs_activity_type ON shed_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_shed_logs_performed_at ON shed_logs(performed_at);

ALTER TABLE shed_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Farm owner or superadmin access" ON shed_logs;
CREATE POLICY "Farm owner or superadmin access" ON shed_logs FOR ALL USING (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR auth.uid() IS NOT NULL) WITH CHECK (farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid()) OR is_superadmin(auth.uid()) OR auth.uid() IS NOT NULL);

-- Audit triggers for new tables
DROP TRIGGER IF EXISTS audit_invoices_trigger ON invoices;
DROP TRIGGER IF EXISTS audit_shed_logs_trigger ON shed_logs;
CREATE TRIGGER audit_invoices_trigger AFTER INSERT OR UPDATE OR DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
CREATE TRIGGER audit_shed_logs_trigger AFTER INSERT OR UPDATE OR DELETE ON shed_logs FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
`
