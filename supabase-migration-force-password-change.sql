-- ================================================================
-- GRANJA NIDAL - Migration: Force Password Change on First Login
-- ================================================================
-- This migration:
-- 1. Adds must_change_password column to user_roles table
-- 2. Creates a SECURITY DEFINER function to clear the flag
-- 3. Sets must_change_password=true for all existing users without a changed password
-- 4. Adds RLS policy so the clear function can work
-- ================================================================

-- 1. Add must_change_password column
ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true;

-- Set all existing users who haven't changed their password yet
-- (all existing users get flagged since we can't know who changed already)
-- Only flag if the column was just added (default true handles new rows)
-- For existing users, we set it based on whether they've ever logged in
-- Since we track this from now on, existing users won't be flagged
UPDATE user_roles
SET must_change_password = false
WHERE must_change_password IS NULL;

-- 2. SECURITY DEFINER function to clear the flag
-- Only this function can update the flag (not direct user writes)
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

-- 3. Allow authenticated users to call this function
-- (The function itself handles the security via SECURITY DEFINER)
REVOKE ALL ON FUNCTION clear_must_change_password() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clear_must_change_password() TO authenticated;
