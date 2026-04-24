---
Task ID: 1
Agent: Main Agent
Task: Add manual "Actualizar" button for KPI recalculation

Work Log:
- Read current page.tsx (1939 lines) to understand structure
- Identified the `calculations` useMemo block that computed all KPIs reactively
- Converted useMemo into a pure `computeCalculations()` function with parameters (cfg, bts, se)
- Added `displayedCalcs` state (useState) to hold the last "confirmed" calculation result
- Added `liveCalcs` useMemo for real-time preview in config sections
- Added `configVersion` counter that increments on any config/batch/structural change
- Added `hasPendingChanges` boolean = configVersion > lastUpdateVersion
- Added `handleUpdateCalculations` callback that copies live → displayed
- Added visual update bar between summary cards and tabs:
  - Amber styling + pulsing dot when changes pending
  - Green styling + checkmark when up to date
  - Animated RefreshCw button icon
- Updated header badges to use `liveCalcs` (always current)
- Updated all config section internal previews to use `liveCalcs` (real-time)
- Top KPI summary cards use `calculations` (= displayedCalcs || liveCalcs), only update on button click
- saveRecord uses `computeCalculations()` directly to always save current values
- Build verified successfully with no errors

Stage Summary:
- Top 6 KPI cards now only update when user clicks "Actualizar" button
- Config sections still show real-time live previews (liveCalcs)
- Visual indicator shows pending changes status (amber=changes pending, green=up to date)
- Header badges always show latest values
- No automatic reactivity for the main dashboard numbers

---
Task ID: 1
Agent: main
Task: Fix feed inventory missing phases + redesign vaccination calendar to be fully editable

Work Log:
- Read and analyzed operations-panel.tsx to understand current feed inventory (3 phases: Postura, Crecimiento, Pre-Inicio) and vaccination calendar (static table, not editable inline)
- Identified missing phases: Inicio and Pre-Postura were not in the feed inventory
- Rewrote operations-panel.tsx with:
  1. Feed inventory: Added ALL 5 phases (Pre-Inicio, Inicio, Crecimiento, Pre-Postura, Postura) with auto-sync from config prices
  2. Feed inventory: Added columns for Semanas, Precio/qq, Aves en fase, Costo/mes estimado
  3. Feed inventory: Migration logic to merge existing localStorage data with missing phases
  4. Feed inventory: Summary bar with total stock, active phases, daily consumption, alerts count
  5. Vaccination calendar: Complete CRUD - add, edit inline, delete, mark as applied
  6. Vaccination calendar: Per-batch, shed, cycle tracking with new fields (via, dosage, lotNumber, cycleNumber, shedId)
  7. Vaccination calendar: Filters by batch, status, shed
  8. Vaccination calendar: Generate default WD80 plan per batch
  9. Vaccination calendar: Copy plan from one batch to another
  10. Vaccination calendar: Batch summary cards showing applied/programmed counts
  11. Vaccination calendar: localStorage persistence for both feed inventory and vaccinations
- Build verified: compiled successfully

Stage Summary:
- operations-panel.tsx completely rewritten with full 5-phase feed inventory and editable vaccination calendar
- Feed inventory now auto-syncs prices from config and shows all Sanut phases
- Vaccination calendar supports per-batch/shed/cycle customization with inline editing

---
Task ID: 3
Agent: Main Agent
Task: Create comprehensive reminders/alerts system for Granja Nidal

Work Log:
- Created `/home/z/my-project/src/components/reminders-panel.tsx` (1,098 lines)
- Features implemented:
  1. 8 reminder categories: Vacunacion, Compra Alimento, Mantenimiento, Pago Servicios, Veterinario, Control Plagas, Infraestructura, Otros
  2. 4 priority levels: Urgente, Alta, Media, Baja with color-coded borders and badges
  3. 4 statuses: Pendiente, En Progreso, Completada, Cancelada
  4. 5 recurrence types: Unica, Diaria, Semanal, Mensual, Trimestral
  5. Stats dashboard: 5 cards (Activos, Urgentes, Prox 7 dias, Completadas/Mes, Vencidos)
  6. Alert banner for urgent/overdue reminders with auto-filter link
  7. Full toolbar: search, 4 filter dropdowns, 2 sort toggles, action buttons
  8. Add/Edit form with all fields: title, description, category, priority, date, time, batch, recurrence, cost, assigned to, notes
  9. Reminder cards with countdown timers, priority border, category icons, expandable details
  10. Quick actions: Complete, Snooze 24h, Edit, Delete
  11. Recurrence logic: auto-creates next instance when completing recurring reminders
  12. Print support with clean table format
  13. Bulk actions: Complete all overdue, Clear old completed (>30 days)
  14. Auto-refresh every 60 seconds for overdue detection
  15. localStorage persistence
- Modified page.tsx:
  - Added RemindersPanel import
  - Added Bell icon import from lucide-react
  - Changed TabsList from grid-cols-7 to grid-cols-8
  - Added "Alertas" tab trigger with Bell icon
  - Added TabsContent for reminders tab passing batches, config, fmtRD, fmtNum
  - Added urgentReminderCount state with localStorage polling (every 2 min)
  - Added clickable alert badge in header with pulse animation when urgent reminders exist
- Build verified: compiled successfully with no errors, no lint issues

Stage Summary:
- New "Alertas" tab added to the app with full reminders management system
- Header shows red alert badge with count when urgent/overdue reminders exist (clickable to navigate)
- All data persists to localStorage under 'granja-wd80-reminders'
