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

---
Task ID: 4
Agent: Main Agent
Task: Create auto-generated reminders synced with batch lifecycle, phases, and vaccinations

Work Log:
- Created `/home/z/my-project/src/lib/auto-reminders.ts` (330 lines) with shared utility functions
- Auto-reminder triggers implemented:
  1. **New batch created** → 9 vaccinations (WD80 schedule), 4 feed phase transitions, 2 milestones (inicio postura + pico), 1 galpon preparation, 1 vet visit, 3 pest control (monthly), 1 cycle-end warning = ~21 reminders per batch
  2. **Phase change detected** → Feed purchase reminder for new phase + production recording prompt when entering postura
  3. **Cycle warning** (3 months left, 1 month left) → Urgent alerts to plan batch replacement
  4. **Batch removed** → All auto-reminders for that batch are cleaned up
- Duplicate prevention: `existsAutoReminder()` checks autoSource + batchId + title fragment
- All auto-reminders identified with `autoSource` flag and prefix "auto-" in ID
- Modified page.tsx:
  - Import auto-reminder functions from `@/lib/auto-reminders`
  - `addBatch()`: calls `generateRemindersForNewBatch()` with setTimeout(100ms)
  - `removeBatch()`: calls `clearAutoRemindersForBatch()` 
  - Added useEffect watching `batches` with `prevBatchesRef` to detect phase changes → `generatePhaseChangeReminders()`
  - Added cycle warning detection in same useEffect → `generateCycleWarningReminder()`
- Updated RemindersPanel:
  - Added `autoSource?: string` to Reminder interface
  - Added AUTO_SOURCE_LABELS and AUTO_SOURCE_COLORS configs (6 source types)
  - Added Sparkles icon import
  - Added `filterOrigin` state ('all' | 'auto' | 'manual') with dropdown in toolbar
  - Added auto-source badge on each reminder card (Sparkles icon + colored label)
  - Added stats card "Auto-generadas" showing count of auto vs manual reminders
  - Stats grid expanded from 5 to 6 columns (lg:grid-cols-6)
- Build verified: compiled successfully, no lint errors

Stage Summary:
- Auto-reminders are generated automatically when: new batch added, phase changes, cycle nearing end
- ~21 reminders auto-generated per new batch covering entire lifecycle
- Each auto-reminder is tagged with origin source and visually distinct (Sparkles badge)
- Filter available to show only auto-generated or only manual reminders
- All auto data persists in same localStorage key, read by RemindersPanel seamlessly
---
Task ID: 1
Agent: main
Task: Crear seccion visual de vista aerea RPG 2D de la granja

Work Log:
- Leido page.tsx completo para entender estructura de datos (batches, config, calculations), tabs, y tipos
- Creado componente FarmMapView en /home/z/my-project/src/components/farm-map-view.tsx
- Integrado en page.tsx: import, nuevo tab "Vista Granja" con icono Map, TabsContent
- Cambiado grid-cols-8 a grid-cols-9 en TabsList
- Build exitoso sin errores, lint limpio para el nuevo componente

Stage Summary:
- Nuevo componente: /home/z/my-project/src/components/farm-map-view.tsx (~550 lineas)
- Caracteristicas RPG: HUD bar con HP/coins/eggs, vista aerea 2D con cielo/nubes/sol, 4 galpones con techos por fase, cercas, silo, tanque de agua, gallinas caminando, arboles pixel art, pasto decorativo, lineas scan retro, animaciones (nubes, sol, huevos, gallinas), barra de progreso de ciclo, estado de feed
- Integracion: Nueva pestana "Vista Granja" como tab 9 de 9

---
Task ID: 2
Agent: main
Task: Pulir vista granja estilo Pokemon retro 90's

Work Log:
- Leido componente farm-map-view.tsx actual (808 lineas)
- Reescrito completamente el componente con estetica Pokemon 90's retro
- Galpones ahora solo muestran sprite de edificio con tejado coloreado por fase
- Datos del galpon aparecen en tooltip tipo dialog box de Pokemon al hacer hover
- Eliminado todo overlapping: mapa usa aspect-ratio 16:9 fijo, posiciones porcentuales exactas
- Estetica Pokemon: bordes negros gruesos (3px), paleta plana sin gradientes, sprite SVG pixel art
- HUD rediseñado como barra Pokemon con stats compartimentados
- Leyenda de fases como barra horizontal con divide
- Build exitoso sin errores, lint limpio

Stage Summary:
- Componente reescrito: /home/z/my-project/src/components/farm-map-view.tsx (~580 lineas)
- Galpones: Solo edificio SVG (pared, tejado por fase, puerta, ventanas, nombre). Hover muestra tooltip con datos completos
- Mapa: 16:9 fijo, cielo con nubes animadas, sol, cesped, cerca perimetral, puerta, silo, tanque de agua, gallinas caminando, letrero
- Tooltip Pokemon: Fondo crema, borde negro, header con color de fase, datos de produccion/crianza, barra de progreso de ciclo
- Sin overlapping: Todas las posiciones son porcentuales dentro de contenedor con aspect-ratio fijo

---
Task ID: 3
Agent: main
Task: Rediseñar vista granja a GTA 2 top-down + arreglar tooltip hover

Work Log:
- Leido componente farm-map-view.tsx actual (~622 lineas) con estilo Pokemon 90's
- Reescrito completamente a estetica GTA 2 top-down aerial (previamente en sesion anterior)
- Bug encontrado: tooltip usaba valores pixel como porcentajes (%), posicionandose fuera de pantalla
- Bug encontrado: contenedor del mapa tenia overflow-hidden, recortando el tooltip
- Fix 1: Convertido posicionamiento a porcentajes correctos en handleHover
- Fix 2: Creado componente FixedTooltip con posicionamiento fixed usando coordenadas del viewport
- Fix 3: Movido tooltip fuera del contenedor del mapa (wrapper relativo sin overflow-hidden)
- Fix 4: Agregada logica de colision con bordes del viewport para que nunca se salga
- Build exitoso sin errores

Stage Summary:
- Tooltip ahora usa fixed positioning con coordenadas absolutas del viewport
- El tooltip se ajusta automaticamente si se acercaria al borde de la pantalla
- z-index 9999 asegura que siempre esta por encima de todo
- Mapa envuelto en div relativo para permitir que el tooltip se posicione correctamente
- Contenido del tooltip sin cambios: nombre, fase, aves, postura%, huevos/dia, ingreso/feed/neto, barra ciclo

---
Task ID: 4
Agent: main
Task: Restructure app from tab-based to lot-centric architecture

Work Log:
- Found that restructure was already partially done in a previous session
- Fixed syntax error in page.tsx: missing closing brace for else-if block in config initialization
- Fixed import error in lot-detail.tsx: `@/components/button` → `@/components/ui/button`
- Build passed successfully

Stage Summary:
- App restructured from 9-tab layout to lot-centric architecture
- New files: lot-card.tsx (132 lines), lot-detail.tsx (481 lines), config-sheet.tsx (521 lines), farm-data.ts (397 lines shared lib)
- page.tsx reduced to 719 lines (state management + routing)
- Dashboard view: KPI cards + lot cards grid + quick access (Reportes, Historial, Vista Granja)
- Lot detail view: breadcrumb + lot header + sub-tabs (General, Producción, Feed, Salud, Finanzas, Alertas)
- Config accessible from gear icon as slide-out sheet
- All state, localStorage keys, calculations, auto-reminders preserved
