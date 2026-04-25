-- ================================================================
-- GRANJA NIDAL - Auth Migration: Add user_id and update RLS
-- Run this migration against your existing Supabase database
-- using the SQL Editor or the Supabase Management API.
-- ================================================================

-- 1. Add user_id column to farms (nullable first for existing data)
ALTER TABLE farms ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_farms_user_id ON farms(user_id);

-- 3. Drop old public access policies
DROP POLICY IF EXISTS "Public access" ON farms;
DROP POLICY IF EXISTS "Public access" ON batches;
DROP POLICY IF EXISTS "Public access" ON daily_entries;
DROP POLICY IF EXISTS "Public access" ON reminders;
DROP POLICY IF EXISTS "Public access" ON structural_expenses;
DROP POLICY IF EXISTS "Public access" ON monthly_records;
DROP POLICY IF EXISTS "Public access" ON feed_inventory;
DROP POLICY IF EXISTS "Public access" ON vaccinations;

-- 4. Create new auth-based RLS policies

-- Farms: only the owner (user_id) can manage their farms
CREATE POLICY "Users can manage their own farms" ON farms
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own farms" ON farms
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- All other tables: restrict via farm ownership
CREATE POLICY "Farm owner access via farms" ON batches
  FOR ALL USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
  ) WITH CHECK (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
  );

CREATE POLICY "Farm owner access via farms" ON daily_entries
  FOR ALL USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
  ) WITH CHECK (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
  );

CREATE POLICY "Farm owner access via farms" ON reminders
  FOR ALL USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
  ) WITH CHECK (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
  );

CREATE POLICY "Farm owner access via farms" ON structural_expenses
  FOR ALL USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
  ) WITH CHECK (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
  );

CREATE POLICY "Farm owner access via farms" ON monthly_records
  FOR ALL USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
  ) WITH CHECK (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
  );

CREATE POLICY "Farm owner access via farms" ON feed_inventory
  FOR ALL USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
  ) WITH CHECK (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
  );

CREATE POLICY "Farm owner access via farms" ON vaccinations
  FOR ALL USING (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
  ) WITH CHECK (
    farm_id IN (SELECT id FROM farms WHERE user_id = auth.uid())
  );
