-- ================================================================
-- GRANJA NIDAL - Migration: SuperAdmin Roles + Audit Log
-- ================================================================
-- This migration:
-- 1. Creates user_roles table for role-based access control
-- 2. Creates audit_log table to track all data changes
-- 3. Creates helper functions for role checking
-- 4. Creates audit triggers on all data tables
-- 5. Updates RLS policies to allow superadmin full access
-- 6. Assigns superadmin to the first authenticated user
-- ================================================================

-- ================================================================
-- 1. USER_ROLES TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('superadmin', 'user')),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- ================================================================
-- 2. AUDIT_LOG TABLE
-- ================================================================
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

-- Indexes for querying audit logs
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_operation ON audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON audit_log(record_id);

-- ================================================================
-- 3. HELPER FUNCTIONS
-- ================================================================

-- Check if a user is a superadmin
CREATE OR REPLACE FUNCTION is_superadmin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = check_user_id AND role = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get the current user's role (returns 'superadmin' or 'user')
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
BEGIN
  IF is_superadmin(auth.uid()) THEN
    RETURN 'superadmin';
  END IF;
  RETURN 'user';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get the current user's email from auth.users
CREATE OR REPLACE FUNCTION current_user_email()
RETURNS TEXT AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ================================================================
-- 4. AUDIT TRIGGER FUNCTION
-- ================================================================
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_old_data JSONB;
  v_new_data JSONB;
  v_changed TEXT[];
  v_col_name TEXT;
  v_user_role TEXT;
BEGIN
  -- Get user role
  v_user_role := current_user_role();

  -- For INSERT: only new data
  IF TG_OP = 'INSERT' THEN
    v_new_data := to_jsonb(NEW);
    v_changed := ARRAY(SELECT jsonb_object_keys(v_new_data));

  -- For UPDATE: both old and new, with changed fields
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_changed := ARRAY(
      SELECT key
      FROM jsonb_each(to_jsonb(NEW))
      WHERE to_jsonb(NEW)->key IS DISTINCT FROM to_jsonb(OLD)->key
    );

  -- For DELETE: only old data
  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_changed := ARRAY(SELECT jsonb_object_keys(v_old_data));
  END IF;

  -- Insert into audit log
  INSERT INTO audit_log (
    table_name,
    operation,
    record_id,
    old_data,
    new_data,
    changed_fields,
    user_id,
    user_email,
    user_role
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    COALESCE(NEW.id, OLD.id),
    v_old_data,
    v_new_data,
    COALESCE(v_changed, '{}'),
    auth.uid(),
    current_user_email(),
    v_user_role
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 5. AUDIT TRIGGERS ON ALL DATA TABLES
-- ================================================================

-- Drop existing triggers if they exist (idempotent)
DROP TRIGGER IF EXISTS audit_farms_trigger ON farms;
DROP TRIGGER IF EXISTS audit_batches_trigger ON batches;
DROP TRIGGER IF EXISTS audit_daily_entries_trigger ON daily_entries;
DROP TRIGGER IF EXISTS audit_reminders_trigger ON reminders;
DROP TRIGGER IF EXISTS audit_structural_expenses_trigger ON structural_expenses;
DROP TRIGGER IF EXISTS audit_monthly_records_trigger ON monthly_records;
DROP TRIGGER IF EXISTS audit_feed_inventory_trigger ON feed_inventory;
DROP TRIGGER IF EXISTS audit_vaccinations_trigger ON vaccinations;
DROP TRIGGER IF EXISTS audit_user_roles_trigger ON user_roles;

-- Create triggers
CREATE TRIGGER audit_farms_trigger
  AFTER INSERT OR UPDATE OR DELETE ON farms
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_batches_trigger
  AFTER INSERT OR UPDATE OR DELETE ON batches
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_daily_entries_trigger
  AFTER INSERT OR UPDATE OR DELETE ON daily_entries
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_reminders_trigger
  AFTER INSERT OR UPDATE OR DELETE ON reminders
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_structural_expenses_trigger
  AFTER INSERT OR UPDATE OR DELETE ON structural_expenses
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_monthly_records_trigger
  AFTER INSERT OR UPDATE OR DELETE ON monthly_records
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_feed_inventory_trigger
  AFTER INSERT OR UPDATE OR DELETE ON feed_inventory
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_vaccinations_trigger
  AFTER INSERT OR UPDATE OR DELETE ON vaccinations
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_user_roles_trigger
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ================================================================
-- 6. RLS FOR user_roles AND audit_log
-- ================================================================
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- user_roles: only superadmins can view and manage roles
CREATE POLICY "Superadmins can view all roles" ON user_roles
  FOR SELECT USING (is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can insert roles" ON user_roles
  FOR INSERT WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can update roles" ON user_roles
  FOR UPDATE USING (is_superadmin(auth.uid())) WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can delete roles" ON user_roles
  FOR DELETE USING (is_superadmin(auth.uid()));

-- Users can view their own role
CREATE POLICY "Users can view own role" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

-- audit_log: only superadmins can view (read-only)
CREATE POLICY "Only superadmins can view audit log" ON audit_log
  FOR SELECT USING (is_superadmin(auth.uid()));

-- Prevent any INSERT/UPDATE/DELETE on audit_log except via trigger (DEFINER)
CREATE POLICY "No direct writes to audit_log" ON audit_log
  FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct updates to audit_log" ON audit_log
  FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "No direct deletes to audit_log" ON audit_log
  FOR DELETE USING (false);

-- ================================================================
-- 7. UPDATE EXISTING RLS POLICIES FOR SUPERADMIN ACCESS
-- ================================================================

-- Drop old farm policies and recreate with superadmin access
DROP POLICY IF EXISTS "Users can manage their own farms" ON farms;
DROP POLICY IF EXISTS "Users can insert their own farms" ON farms;

CREATE POLICY "Users can manage their own farms" ON farms
  FOR ALL USING (
    auth.uid() = user_id OR is_superadmin(auth.uid())
  ) WITH CHECK (
    auth.uid() = user_id OR is_superadmin(auth.uid())
  );

-- Drop and recreate policies for all child tables with superadmin access
DROP POLICY IF EXISTS "Farm owner access via farms" ON batches;
CREATE POLICY "Farm owner or superadmin access" ON batches
  FOR ALL USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
    OR is_superadmin(auth.uid())
  ) WITH CHECK (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
    OR is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Farm owner access via farms" ON daily_entries;
CREATE POLICY "Farm owner or superadmin access" ON daily_entries
  FOR ALL USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
    OR is_superadmin(auth.uid())
  ) WITH CHECK (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
    OR is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Farm owner access via farms" ON reminders;
CREATE POLICY "Farm owner or superadmin access" ON reminders
  FOR ALL USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
    OR is_superadmin(auth.uid())
  ) WITH CHECK (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
    OR is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Farm owner access via farms" ON structural_expenses;
CREATE POLICY "Farm owner or superadmin access" ON structural_expenses
  FOR ALL USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
    OR is_superadmin(auth.uid())
  ) WITH CHECK (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
    OR is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Farm owner access via farms" ON monthly_records;
CREATE POLICY "Farm owner or superadmin access" ON monthly_records
  FOR ALL USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
    OR is_superadmin(auth.uid())
  ) WITH CHECK (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
    OR is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Farm owner access via farms" ON feed_inventory;
CREATE POLICY "Farm owner or superadmin access" ON feed_inventory
  FOR ALL USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
    OR is_superadmin(auth.uid())
  ) WITH CHECK (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
    OR is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Farm owner access via farms" ON vaccinations;
CREATE POLICY "Farm owner or superadmin access" ON vaccinations
  FOR ALL USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
    OR is_superadmin(auth.uid())
  ) WITH CHECK (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
    OR is_superadmin(auth.uid())
  );

-- ================================================================
-- 8. ASSIGN SUPERADMIN TO FIRST EXISTING AUTH USER (if any)
-- ================================================================
INSERT INTO user_roles (user_id, role, assigned_by)
SELECT id, 'superadmin', id
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_roles)
LIMIT 1
ON CONFLICT (user_id) DO NOTHING;
