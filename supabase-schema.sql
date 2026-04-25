-- ================================================================
-- GRANJA NIDAL - Supabase Database Schema
-- Multi-tenant farm management
-- ================================================================

-- farms table (multi-tenant, each farm has its own data)
CREATE TABLE IF NOT EXISTS farms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- batches/lots
CREATE TABLE IF NOT EXISTS batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
  batch_key TEXT NOT NULL,
  name TEXT NOT NULL,
  hens INTEGER DEFAULT 2000,
  laying_rate NUMERIC(5,2) DEFAULT 80,
  is_laying BOOLEAN DEFAULT FALSE,
  cycle_month NUMERIC(5,2) DEFAULT 0,
  phase TEXT DEFAULT 'pre_inicio',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(farm_id, batch_key)
);

-- daily production entries
CREATE TABLE IF NOT EXISTS daily_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  eggs_collected INTEGER DEFAULT 0,
  eggs_broken INTEGER DEFAULT 0,
  mortality INTEGER DEFAULT 0,
  feed_kg NUMERIC(10,2) DEFAULT 0,
  water_liters NUMERIC(10,2) DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(farm_id, batch_id, date)
);

-- reminders/alerts
CREATE TABLE IF NOT EXISTS reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'otros',
  priority TEXT DEFAULT 'media',
  status TEXT DEFAULT 'pendiente',
  due_date DATE,
  due_time TEXT DEFAULT '08:00',
  recurrence TEXT DEFAULT 'unica',
  recurrence_end DATE,
  completed_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  estimated_cost NUMERIC(10,2) DEFAULT 0,
  assigned_to TEXT DEFAULT '',
  auto_source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- structural expenses
CREATE TABLE IF NOT EXISTS structural_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
  description TEXT DEFAULT '',
  amount NUMERIC(12,2) DEFAULT 0,
  frequency TEXT DEFAULT 'unico',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- monthly records (snapshots)
CREATE TABLE IF NOT EXISTS monthly_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  record_date TEXT NOT NULL,
  batches_snapshot JSONB DEFAULT '[]',
  config_snapshot JSONB DEFAULT '{}',
  notes TEXT DEFAULT '',
  revenue NUMERIC(14,2) DEFAULT 0,
  expenses NUMERIC(14,2) DEFAULT 0,
  net NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- feed inventory
CREATE TABLE IF NOT EXISTS feed_inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
  phase_key TEXT NOT NULL UNIQUE,
  phase TEXT NOT NULL,
  current_stock_kg NUMERIC(10,2) DEFAULT 0,
  reorder_level_kg NUMERIC(10,2) DEFAULT 0,
  last_purchase DATE,
  supplier TEXT DEFAULT '',
  price_per_quintal NUMERIC(10,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- vaccinations
CREATE TABLE IF NOT EXISTS vaccinations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  shed_id TEXT DEFAULT '',
  cycle_number INTEGER DEFAULT 1,
  vaccine_name TEXT NOT NULL,
  date_applied DATE,
  age_weeks INTEGER DEFAULT 0,
  next_dose DATE,
  applied_by TEXT DEFAULT '',
  via TEXT DEFAULT 'Ocular',
  dosage TEXT DEFAULT '',
  lot_number TEXT DEFAULT '',
  status TEXT DEFAULT 'programada',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- INDEXES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_batches_farm_id ON batches(farm_id);
CREATE INDEX IF NOT EXISTS idx_daily_entries_farm_id ON daily_entries(farm_id);
CREATE INDEX IF NOT EXISTS idx_daily_entries_batch_id ON daily_entries(batch_id);
CREATE INDEX IF NOT EXISTS idx_daily_entries_date ON daily_entries(date);
CREATE INDEX IF NOT EXISTS idx_reminders_farm_id ON reminders(farm_id);
CREATE INDEX IF NOT EXISTS idx_reminders_batch_id ON reminders(batch_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON reminders(due_date);
CREATE INDEX IF NOT EXISTS idx_structural_expenses_farm_id ON structural_expenses(farm_id);
CREATE INDEX IF NOT EXISTS idx_monthly_records_farm_id ON monthly_records(farm_id);
CREATE INDEX IF NOT EXISTS idx_feed_inventory_farm_id ON feed_inventory(farm_id);
CREATE INDEX IF NOT EXISTS idx_vaccinations_farm_id ON vaccinations(farm_id);
CREATE INDEX IF NOT EXISTS idx_vaccinations_batch_id ON vaccinations(batch_id);
CREATE INDEX IF NOT EXISTS idx_vaccinations_date_applied ON vaccinations(date_applied);

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE structural_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaccinations ENABLE ROW LEVEL SECURITY;

-- For now, allow public read/write (will add auth later)
CREATE POLICY "Public access" ON farms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON daily_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON reminders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON structural_expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON monthly_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON feed_inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON vaccinations FOR ALL USING (true) WITH CHECK (true);
