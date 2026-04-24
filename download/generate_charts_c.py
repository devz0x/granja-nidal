import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import json
import numpy as np

# Font setup
matplotlib.font_manager.fontManager.addfont('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
plt.rcParams['font.sans-serif'] = ['DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

# Load strategy data
with open('/home/z/my-project/download/strategy_data.json', 'r') as f:
    data = json.load(f)

C = data['C']
monthly = C['monthly']

# Colors
ACCENT = '#6240c8'
ACCENT2 = '#e8723a'
ACCENT3 = '#2e96b0'
GREEN = '#3a9648'
RED = '#c84040'
MUTED = '#8a867d'
BG = '#f8f7f5'

months = [d['m'] for d in monthly]
revs = [d['rev'] for d in monthly]
costs = [d['cost'] for d in monthly]
cums = [d['cum'] for d in monthly]
egg_revs = [d.get('eggRev', d['rev']) for d in monthly]
hen_sales = [d.get('henSale', 0) for d in monthly]

# ---- CHART 1: Monthly Cash Flow (Revenue vs Costs) ----
fig, ax = plt.subplots(figsize=(14, 5.5))
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)

x = np.array(months)
w = 0.35
bars1 = ax.bar(x - w/2, [r/1e6 for r in revs], w, label='Ingresos', color=GREEN, alpha=0.85, zorder=3)
bars2 = ax.bar(x + w/2, [c/1e6 for c in costs], w, label='Costos', color=RED, alpha=0.85, zorder=3)

ax.set_xlabel('Mes', fontsize=11, color=MUTED)
ax.set_ylabel('Millones RD$', fontsize=11, color=MUTED)
ax.set_title('Flujo Mensual de Caja - Estrategia C', fontsize=14, fontweight='bold', color='#242320', pad=15)
ax.set_xticks(range(0, 61, 3))
ax.legend(loc='upper left', fontsize=10, framealpha=0.9)
ax.grid(axis='y', alpha=0.3, linestyle='--')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

# Add hen sale markers
sale_months = [m for m, h in zip(months, hen_sales) if h > 0]
sale_vals = [h/1e6 for m, h in zip(months, hen_sales) if h > 0]
ax.scatter(sale_months, sale_vals, color=ACCENT2, s=80, zorder=5, marker='D', label='Venta gallinas')
ax.legend(loc='upper left', fontsize=10, framealpha=0.9)

plt.tight_layout()
plt.savefig('/home/z/my-project/download/chart_c_cashflow.png', dpi=200, bbox_inches='tight', facecolor=BG)
plt.close()
print("Chart 1 OK")

# ---- CHART 2: Cumulative Cash Flow ----
fig, ax = plt.subplots(figsize=(14, 5))
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)

ax.fill_between(months, [c/1e6 for c in cums], 0, 
                where=[c >= 0 for c in cums], color=GREEN, alpha=0.15, interpolate=True)
ax.fill_between(months, [c/1e6 for c in cums], 0, 
                where=[c < 0 for c in cums], color=RED, alpha=0.1, interpolate=True)
ax.plot(months, [c/1e6 for c in cums], color=ACCENT, linewidth=2.5, zorder=3)

# Break-even line
ax.axhline(y=0, color=MUTED, linewidth=0.8, linestyle='-')
be_month = None
for d in monthly:
    if d['cum'] >= 0:
        be_month = d['m']
        break
if be_month:
    ax.axvline(x=be_month, color=ACCENT2, linewidth=1.5, linestyle='--', alpha=0.7)
    ax.annotate(f'Break-even\nMes {be_month}', xy=(be_month, 0), xytext=(be_month+3, -1.5),
                fontsize=10, color=ACCENT2, fontweight='bold',
                arrowprops=dict(arrowstyle='->', color=ACCENT2, lw=1.5))

ax.set_xlabel('Mes', fontsize=11, color=MUTED)
ax.set_ylabel('Millones RD$', fontsize=11, color=MUTED)
ax.set_title('Flujo de Caja Acumulado - Estrategia C', fontsize=14, fontweight='bold', color='#242320', pad=15)
ax.set_xticks(range(0, 61, 3))
ax.grid(axis='y', alpha=0.3, linestyle='--')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

plt.tight_layout()
plt.savefig('/home/z/my-project/download/chart_c_cumulative.png', dpi=200, bbox_inches='tight', facecolor=BG)
plt.close()
print("Chart 2 OK")

# ---- CHART 3: Operations Timeline (Gantt-style) ----
fig, ax = plt.subplots(figsize=(14, 6))
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)

# Batch definitions for Strategy C
# Cycle 1: batches start at months 0, 2, 4, 6
# Laying starts at month 5 from batch start (18-19 weeks)
# Cycle 1 laying: 20 months
# Replacement chicks bought 2 months before end of laying
# Sale of old hens at end of 20-month laying

batches_cycle1 = [
    {"name": "Lote 1 (Galpon 1)", "start": 0, "laying_start": 5, "laying_end": 24, "sold": 25},
    {"name": "Lote 2 (Galpon 2)", "start": 2, "laying_start": 7, "laying_end": 26, "sold": 27},
    {"name": "Lote 3 (Galpon 3)", "start": 4, "laying_start": 9, "laying_end": 28, "sold": 29},
    {"name": "Lote 4 (Galpon 4)", "start": 6, "laying_start": 11, "laying_end": 30, "sold": 31},
]

# Cycle 2 replacements (2 months before sale of cycle 1)
batches_cycle2 = [
    {"name": "Lote 1 C2", "start": 20, "laying_start": 25, "laying_end": 44, "sold": 45},
    {"name": "Lote 2 C2", "start": 22, "laying_start": 27, "laying_end": 46, "sold": 47},
    {"name": "Lote 3 C2", "start": 24, "laying_start": 29, "laying_end": 48, "sold": 49},
    {"name": "Lote 4 C2", "start": 26, "laying_start": 31, "laying_end": 50, "sold": 51},
]

colors_gantt = ['#6240c8', '#e8723a', '#2e96b0', '#3a9648']
all_batches = batches_cycle1 + batches_cycle2

for i, batch in enumerate(all_batches):
    color = colors_gantt[i % 4]
    y = len(all_batches) - 1 - i
    
    # Pre-lay phase (growth)
    ax.barh(y, batch['laying_start'] - batch['start'], left=batch['start'], 
            height=0.6, color=color, alpha=0.3, edgecolor=color, linewidth=0.5)
    # Laying phase
    ax.barh(y, batch['laying_end'] - batch['laying_start'] + 1, left=batch['laying_start'], 
            height=0.6, color=color, alpha=0.8, edgecolor=color, linewidth=0.5)
    # Sale marker
    ax.scatter(batch['sold'], y, color=RED, s=60, zorder=5, marker='v')

ax.set_yticks(range(len(all_batches)))
ax.set_yticklabels([b['name'] for b in reversed(all_batches)], fontsize=9)
ax.set_xlabel('Mes', fontsize=11, color=MUTED)
ax.set_title('Cronograma de Operaciones - Ciclo 1 y Ciclo 2', fontsize=14, fontweight='bold', color='#242320', pad=15)
ax.set_xticks(range(0, 55, 3))
ax.grid(axis='x', alpha=0.3, linestyle='--')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

# Legend
from matplotlib.patches import Patch
legend_elements = [
    Patch(facecolor=colors_gantt[0], alpha=0.3, label='Cria/Pre-postura'),
    Patch(facecolor=colors_gantt[0], alpha=0.8, label='Postura (produccion)'),
    plt.Line2D([0], [0], marker='v', color='w', markerfacecolor=RED, markersize=10, label='Venta gallinas')
]
ax.legend(handles=legend_elements, loc='upper right', fontsize=9, framealpha=0.9)

plt.tight_layout()
plt.savefig('/home/z/my-project/download/chart_c_timeline.png', dpi=200, bbox_inches='tight', facecolor=BG)
plt.close()
print("Chart 3 OK")

# ---- CHART 4: Annual Revenue Breakdown ----
fig, ax = plt.subplots(figsize=(10, 5))
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)

C_years = data['comparison']['C_years']
years = ['Ano 1', 'Ano 2', 'Ano 3', 'Ano 4', 'Ano 5']
egg_revs_y = [y['eggRev'] for y in C_years]
hen_revs_y = [y['henRev'] for y in C_years]
net_y = [y['net'] for y in C_years]

x_pos = np.arange(len(years))
w = 0.35

bars_egg = ax.bar(x_pos - w/2, [e/1e6 for e in egg_revs_y], w, label='Venta Huevos', color=GREEN, alpha=0.85)
bars_hen = ax.bar(x_pos + w/2, [h/1e6 for h in hen_revs_y], w, label='Venta Gallinas', color=ACCENT2, alpha=0.85)

# Add net line
ax2 = ax.twinx()
ax2.plot(x_pos, [n/1e6 for n in net_y], color=ACCENT, linewidth=2.5, marker='o', markersize=8, label='Beneficio Neto', zorder=5)

ax.set_xlabel('Periodo', fontsize=11, color=MUTED)
ax.set_ylabel('Millones RD$', fontsize=11, color=MUTED)
ax2.set_ylabel('Beneficio Neto (Millones RD$)', fontsize=11, color=ACCENT)
ax.set_title('Resultados Anuales - Estrategia C', fontsize=14, fontweight='bold', color='#242320', pad=15)
ax.set_xticks(x_pos)
ax.set_xticklabels(years, fontsize=10)

# Combine legends
lines1, labels1 = ax.get_legend_handles_labels()
lines2, labels2 = ax2.get_legend_handles_labels()
ax.legend(lines1 + lines2, labels1 + labels2, loc='upper left', fontsize=9, framealpha=0.9)

ax.grid(axis='y', alpha=0.3, linestyle='--')
ax.spines['top'].set_visible(False)
ax2.spines['top'].set_visible(False)

# Add value labels on bars
for bar in bars_egg:
    h = bar.get_height()
    if h > 0:
        ax.text(bar.get_x() + bar.get_width()/2., h + 0.1, f'{h:.1f}M', ha='center', va='bottom', fontsize=8, color=MUTED)
for bar in bars_hen:
    h = bar.get_height()
    if h > 0:
        ax.text(bar.get_x() + bar.get_width()/2., h + 0.1, f'{h:.1f}M', ha='center', va='bottom', fontsize=8, color=MUTED)

plt.tight_layout()
plt.savefig('/home/z/my-project/download/chart_c_annual.png', dpi=200, bbox_inches='tight', facecolor=BG)
plt.close()
print("Chart 4 OK")

# ---- CHART 5: Investment Breakdown Pie ----
fig, ax = plt.subplots(figsize=(8, 6))
fig.patch.set_facecolor(BG)

labels_pie = ['Infraestructura\n(Galpones)', 'Aves + Equipo\n+ Vacunas (Inicial)', 'Alimentacion\nCiclo 1', 'Reemplazos\nCiclo 2', 'Gastos Fijos\n5 Anos']
values_pie = [1569750, 1407832, 9600000, 1920000, 565000*60 - 565000*5]  # Adjusted
# Simplified: infrastructure, initial birds, feed, replacements, fixed costs
init_inv = C['summary']['initInv']
repl_cost = C['summary']['replCost']
total_cost = C['summary']['totalCost']

# Break down from the data
infra = 624750 + 315000*3  # B1 + B2+B3+B4 = 1,569,750
birds_init = 351958 * 4  # 1,407,832
total_feed = 0
total_fixed = 0
for d in monthly:
    total_fixed += 55000 if d['m'] <= 4 else (70000 if d['m'] <= 10 else 85000)
# Actually let's use simpler categories
categories = {
    'Infraestructura': infra,
    'Aves, Equipo y Vacunas\n(Inicial)': birds_init,
    'Reemplazos Ciclo 2': repl_cost,
    'Costos Operativos\n(Alimento + Fijos)': total_cost - infra - birds_init - repl_cost
}

labels_p = list(categories.keys())
values_p = list(categories.values())
colors_p = [ACCENT, ACCENT2, ACCENT3, '#b0a890']
explode = (0, 0, 0.08, 0)

wedges, texts, autotexts = ax.pie(values_p, labels=labels_p, autopct='%1.1f%%', 
                                   colors=colors_p, explode=explode, startangle=140,
                                   textprops={'fontsize': 9, 'color': '#242320'},
                                   pctdistance=0.75, labeldistance=1.15)

for autotext in autotexts:
    autotext.set_fontsize(9)
    autotext.set_fontweight('bold')
    autotext.set_color('white')

ax.set_title('Desglose de Inversion Total - Estrategia C', fontsize=14, fontweight='bold', color='#242320', pad=15)

plt.tight_layout()
plt.savefig('/home/z/my-project/download/chart_c_investment.png', dpi=200, bbox_inches='tight', facecolor=BG)
plt.close()
print("Chart 5 OK")

print("All charts generated successfully!")
