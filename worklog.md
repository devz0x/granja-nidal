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
