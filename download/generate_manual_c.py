# -*- coding: utf-8 -*-
import json, hashlib, os, sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm, mm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak,
                                 Table, TableStyle, Image, KeepTogether, CondPageBreak)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from pypdf import PdfReader, PdfWriter, Transformation

# ========= FONTS =========
pdfmetrics.registerFont(TTFont('LiberationSans', '/usr/share/fonts/truetype/chinese/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Carlito', '/usr/share/fonts/truetype/english/Carlito-Regular.ttf'))
pdfmetrics.registerFont(TTFont('CarlitoBold', '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSansBold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
registerFontFamily('Carlito', normal='Carlito', bold='CarlitoBold')
registerFontFamily('LiberationSans', normal='LiberationSans', bold='LiberationSans')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSansBold')

# ========= PALETTE =========
ACCENT = colors.HexColor('#6240c8')
ACCENT2 = colors.HexColor('#e8723a')
ACCENT3 = colors.HexColor('#2e96b0')
GREEN = colors.HexColor('#3a9648')
RED = colors.HexColor('#c84040')
TEXT_PRIMARY = colors.HexColor('#242320')
TEXT_MUTED = colors.HexColor('#8a867d')
BG_SURFACE = colors.HexColor('#e3e0da')
BG_PAGE = colors.HexColor('#efeeeb')

TABLE_HEADER_COLOR = ACCENT
TABLE_HEADER_TEXT = colors.white
TABLE_ROW_EVEN = colors.white
TABLE_ROW_ODD = BG_SURFACE

# ========= STYLES =========
W, H = A4
LM, RM, TM, BM = 1.1*inch, 0.9*inch, 0.9*inch, 0.8*inch
AW = W - LM - RM  # available width

styles = getSampleStyleSheet()

sH1 = ParagraphStyle('H1', fontName='Carlito', fontSize=20, leading=26,
    spaceBefore=18, spaceAfter=10, textColor=TEXT_PRIMARY, alignment=TA_LEFT)
sH2 = ParagraphStyle('H2', fontName='Carlito', fontSize=15, leading=20,
    spaceBefore=14, spaceAfter=8, textColor=ACCENT, alignment=TA_LEFT)
sH3 = ParagraphStyle('H3', fontName='Carlito', fontSize=12, leading=16,
    spaceBefore=10, spaceAfter=6, textColor=TEXT_PRIMARY, alignment=TA_LEFT)
sBody = ParagraphStyle('Body', fontName='Carlito', fontSize=10.5, leading=17,
    spaceBefore=0, spaceAfter=6, textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY)
sBodyLeft = ParagraphStyle('BodyL', fontName='Carlito', fontSize=10.5, leading=17,
    spaceBefore=0, spaceAfter=6, textColor=TEXT_PRIMARY, alignment=TA_LEFT)
sSmall = ParagraphStyle('Small', fontName='Carlito', fontSize=9, leading=14,
    spaceBefore=2, spaceAfter=2, textColor=TEXT_MUTED, alignment=TA_LEFT)
sCaption = ParagraphStyle('Caption', fontName='Carlito', fontSize=9, leading=13,
    spaceBefore=4, spaceAfter=8, textColor=TEXT_MUTED, alignment=TA_CENTER)
sTH = ParagraphStyle('TH', fontName='Carlito', fontSize=9.5, leading=13,
    textColor=colors.white, alignment=TA_CENTER)
sTC = ParagraphStyle('TC', fontName='Carlito', fontSize=9, leading=13,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER)
sTCL = ParagraphStyle('TCL', fontName='Carlito', fontSize=9, leading=13,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT)
sTCR = ParagraphStyle('TCR', fontName='Carlito', fontSize=9, leading=13,
    textColor=TEXT_PRIMARY, alignment=TA_RIGHT)
sCallout = ParagraphStyle('Callout', fontName='Carlito', fontSize=11, leading=17,
    spaceBefore=8, spaceAfter=8, textColor=ACCENT, alignment=TA_LEFT,
    leftIndent=12, borderWidth=0, borderPadding=6)
sBullet = ParagraphStyle('Bullet', fontName='Carlito', fontSize=10.5, leading=17,
    spaceBefore=2, spaceAfter=4, textColor=TEXT_PRIMARY, alignment=TA_LEFT,
    leftIndent=24, bulletIndent=12)

# ========= TOC TEMPLATE =========
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

def add_heading(text, style, level=0):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/>%s' % (key, text), style)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def make_table(data, col_widths, repeat_rows=0):
    """Create a styled table."""
    t = Table(data, colWidths=col_widths, hAlign='CENTER', repeatRows=repeat_rows)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('GRID', (0, 0), (-1, -1), 0.4, TEXT_MUTED),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_ODD if i % 2 == 0 else TABLE_ROW_EVEN
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

def fmt(v):
    """Format number as RD$ with thousands separator."""
    if v < 0:
        return f'-RD${abs(v):,.0f}'
    return f'RD${v:,.0f}'

def fmtm(v):
    """Format number as millions."""
    return f'RD${v/1e6:,.1f}M'

# ========= LOAD DATA =========
with open('/home/z/my-project/download/strategy_data.json', 'r') as f:
    data = json.load(f)

C = data['C']
monthly = C['monthly']
summary = C['summary']

# ========= BUILD STORY =========
story = []

# -- TOC --
toc = TableOfContents()
toc.levelStyles = [
    ParagraphStyle('TOC1', fontName='Carlito', fontSize=13, leftIndent=20, leading=20, spaceBefore=6, spaceAfter=2, textColor=TEXT_PRIMARY),
    ParagraphStyle('TOC2', fontName='Carlito', fontSize=11, leftIndent=40, leading=16, spaceBefore=2, spaceAfter=1, textColor=TEXT_MUTED),
]
story.append(Paragraph('<b>Tabla de Contenidos</b>', ParagraphStyle('TOCTitle', fontName='Carlito', fontSize=20, leading=28, textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceAfter=16)))
story.append(toc)
story.append(PageBreak())

# ========= SECTION 1: RESUMEN EJECUTIVO =========
story.append(add_heading('<b>1. Resumen Ejecutivo de la Estrategia C</b>', sH1, 0))
story.append(Paragraph(
    'La Estrategia C, denominada "Ciclo 20 meses con cria anticipada", es el plan operativo de mayor rentabilidad '
    'para Granja Gallinas WD80. Este modelo se distingue de las alternativas por una caracteristica fundamental: '
    'la compra de pollitas de reemplazo se realiza dos meses antes de la venta de las gallinas de desecho del ciclo '
    'anterior, eliminando por completo los periodos sin produccion entre ciclos. Esta decision estrategica permite '
    'mantener los cuatro galpones en produccion continua durante los 60 meses de la proyeccion, maximizando los ingresos '
    'por venta de huevos y optimizando el retorno sobre la inversion total.',
    sBody))
story.append(Spacer(1, 6))

story.append(Paragraph(
    'A lo largo de los 5 anos proyectados, la granja genera ingresos totales por RD$56.5 millones, provenientes de '
    'la venta de 9.98 millones de huevos y la disposicion de 16,000 gallinas de desecho a RD$100 por unidad. '
    'El punto de equilibrio se alcanza en el mes 19 de operacion, y el flujo de caja acumulado al cierre del mes 60 '
    'asciende a RD$15.6 millones, representando un retorno sobre la inversion (ROI) del 224.1%, el mas alto entre '
    'las tres estrategias evaluadas.',
    sBody))
story.append(Spacer(1, 12))

# KPI Table
story.append(add_heading('<b>1.1 Indicadores Clave de Rendimiento</b>', sH2, 1))
kpi_data = [
    [Paragraph('<b>Indicador</b>', sTH), Paragraph('<b>Valor</b>', sTH)],
    [Paragraph('Inversion Total (Inicial + Reemplazos)', sTCL), Paragraph(fmt(summary['initInv'] + summary['replCost']), sTCR)],
    [Paragraph('Inversion Inicial (Mes 0-6)', sTCL), Paragraph(fmt(summary['initInv']), sTCR)],
    [Paragraph('Costo Total de Reemplazos (8 lotes)', sTCL), Paragraph(fmt(summary['replCost']), sTCR)],
    [Paragraph('Ingresos Totales (Huevos + Gallinas)', sTCL), Paragraph(fmt(summary['totalRev']), sTCR)],
    [Paragraph('Gastos Operativos Totales', sTCL), Paragraph(fmt(summary['totalCost']), sTCR)],
    [Paragraph('Beneficio Neto Acumulado (Mes 60)', sTCL), Paragraph(fmt(summary['finalCum']), sTCR)],
    [Paragraph('ROI', sTCL), Paragraph(f"{summary['roi']}%", sTCR)],
    [Paragraph('Punto de Equilibrio', sTCL), Paragraph(f"Mes {summary['be']}", sTCR)],
    [Paragraph('Huevos Totales Vendidos', sTCL), Paragraph(f"{summary['totalEgg']:,}", sTCR)],
    [Paragraph('Gallinas de Desecho Vendidas', sTCL), Paragraph(f"{summary['totalHens']:,}", sTCR)],
    [Paragraph('Numero de Reemplazos Ejecutados', sTCL), Paragraph(str(summary['replCount']), sTCR)],
    [Paragraph('Deficit Maximo (Mes mas bajo)', sTCL), Paragraph(fmt(summary['peakNeg']), sTCR)],
]
cw = [AW*0.65, AW*0.35]
story.append(Spacer(1, 10))
story.append(make_table(kpi_data, cw, repeat_rows=1))
story.append(Paragraph('Tabla 1. Indicadores clave de rendimiento - Estrategia C (5 anos)', sCaption))

story.append(Spacer(1, 12))

# ========= SECTION 2: DESCRIPCION DE LA ESTRATEGIA =========
story.append(add_heading('<b>2. Descripcion de la Estrategia C</b>', sH1, 0))

story.append(add_heading('<b>2.1 Concepto: Cria Anticipada</b>', sH2, 1))
story.append(Paragraph(
    'La piedra angular de la Estrategia C es la "cria anticipada", un mecanismo que consiste en adquirir las '
    'pollitas de reemplazo exactamente dos meses antes de que las gallinas del ciclo actual cumplan su periodo '
    'productivo de 20 meses. Durante estos dos meses de solapamiento, la granja mantiene simultaneamente gallinas '
    'en postura (generando ingresos) y pollitas en fase de crecimiento (consumiendo alimento de pre-inicio, inicio, '
    'crecimiento y pre-postura). Este overlap temporal es el secreto de la superioridad financiera de esta estrategia: '
    'cuando las gallinas viejas se venden, las nuevas ya estan a punto de iniciar la postura, lo que reduce el tiempo '
    'muerto entre ciclos a practicamente cero.',
    sBody))
story.append(Spacer(1, 6))

story.append(Paragraph(
    'En contraste, las Estrategias A y B esperan hasta despues de vender las gallinas para comprar las nuevas, '
    'lo que genera un periodo de 2 a 5 meses sin produccion por cada reemplazo. En un horizonte de 5 anos con '
    '8 reemplazos totales, estos periodos muertos acumulan entre 16 y 40 meses de produccion perdida, lo que '
    'explica por que la Estrategia C supera a sus competidoras por un margen significativo: RD$15.6M vs. RD$11.4M '
    '(Estrategia B) y RD$10.1M (Estrategia A) en beneficio neto acumulado.',
    sBody))
story.append(Spacer(1, 8))

story.append(add_heading('<b>2.2 Parametros Operativos</b>', sH2, 1))
param_data = [
    [Paragraph('<b>Parametro</b>', sTH), Paragraph('<b>Valor</b>', sTH)],
    [Paragraph('Raza', sTCL), Paragraph('WD80 (Hy-Line Brown)', sTC)],
    [Paragraph('Numero de galpones', sTCL), Paragraph('4', sTC)],
    [Paragraph('Aves por galpon (lote)', sTCL), Paragraph('2,000', sTC)],
    [Paragraph('Total de aves en operacion', sTCL), Paragraph('8,000 (cuando los 4 lotes estan en postura)', sTC)],
    [Paragraph('Espaciamiento inicial entre lotes', sTCL), Paragraph('2 meses (Meses 0, 2, 4, 6)', sTC)],
    [Paragraph('Inicio de postura', sTCL), Paragraph('Semana 18-19 desde la compra (mes 5)', sTC)],
    [Paragraph('Duracion del ciclo de postura', sTCL), Paragraph('20 meses por lote', sTC)],
    [Paragraph('Porcentaje de postura promedio', sTCL), Paragraph('80%', sTC)],
    [Paragraph('Precio de venta del huevo', sTCL), Paragraph('RD$5.50 por unidad', sTC)],
    [Paragraph('Ingreso mensual por lote en postura', sTCL), Paragraph('RD$264,000 (2,000 x 80% x 30 x 5.50)', sTC)],
    [Paragraph('Alimento en postura (por lote)', sTCL), Paragraph('RD$120,000/mes (~80 qq x RD$1,500)', sTC)],
    [Paragraph('Venta de gallinas de desecho', sTCL), Paragraph('RD$100/unidad = RD$200,000 por lote', sTC)],
    [Paragraph('Anticipacion de reemplazo', sTCL), Paragraph('2 meses antes de la venta', sTC)],
]
story.append(make_table(param_data, [AW*0.55, AW*0.45], repeat_rows=1))
story.append(Paragraph('Tabla 2. Parametros operativos de la Estrategia C', sCaption))

# ========= SECTION 3: INVERSION INICIAL =========
story.append(add_heading('<b>3. Inversion Inicial (Meses 0-6)</b>', sH1, 0))
story.append(Paragraph(
    'La inversion inicial de la Estrategia C asciende a RD$5,041,822 y se distribuye a lo largo de los primeros '
    '6 meses, coincidiendo con la entrada escalonada de los 4 lotes. La mayor concentracion de capital ocurre en '
    'los meses donde se adquieren multiples lotes simultaneamente (infrastructure mas aves). A continuacion se '
    'detalla el desglose completo de la inversion por categoria y por mes.',
    sBody))
story.append(Spacer(1, 8))

story.append(add_heading('<b>3.1 Desglose por Categoria</b>', sH2, 1))
inv_cat = [
    [Paragraph('<b>Categoria</b>', sTH), Paragraph('<b>Lote 1</b>', sTH),
     Paragraph('<b>Lote 2</b>', sTH), Paragraph('<b>Lote 3</b>', sTH), Paragraph('<b>Lote 4</b>', sTH), Paragraph('<b>Total</b>', sTH)],
    [Paragraph('Galpon (infraestructura)', sTCL), Paragraph('RD$375,000', sTCR), Paragraph('RD$200,000', sTCR), Paragraph('RD$200,000', sTCR), Paragraph('RD$200,000', sTCR), Paragraph('RD$975,000', sTCR)],
    [Paragraph('Almacen + bomba de agua', sTCL), Paragraph('RD$124,750', sTCR), Paragraph('--', sTC), Paragraph('--', sTC), Paragraph('--', sTC), Paragraph('RD$124,750', sTCR)],
    [Paragraph('Equipo de galpon', sTCL), Paragraph('RD$47,200', sTCR), Paragraph('RD$47,200', sTCR), Paragraph('RD$47,200', sTCR), Paragraph('RD$47,200', sTCR), Paragraph('RD$188,800', sTCR)],
    [Paragraph('Compra de aves (2,000)', sTCL), Paragraph('RD$172,200', sTCR), Paragraph('RD$172,200', sTCR), Paragraph('RD$172,200', sTCR), Paragraph('RD$172,200', sTCR), Paragraph('RD$688,800', sTCR)],
    [Paragraph('Vacunas y medicamentos', sTCL), Paragraph('RD$52,678', sTCR), Paragraph('RD$52,678', sTCR), Paragraph('RD$52,678', sTCR), Paragraph('RD$52,678', sTCR), Paragraph('RD$210,712', sTCR)],
    [Paragraph('Alimentacion pre-postura (5 meses)', sTCL), Paragraph('RD$82,080', sTCR), Paragraph('RD$82,080', sTCR), Paragraph('RD$82,080', sTCR), Paragraph('RD$82,080', sTCR), Paragraph('RD$328,320', sTCR)],
    [Paragraph('Galpon extra (B2-B4)', sTCL), Paragraph('--', sTC), Paragraph('RD$115,000', sTCR), Paragraph('RD$115,000', sTCR), Paragraph('RD$115,000', sTCR), Paragraph('RD$345,000', sTCR)],
    [Paragraph('<b>TOTAL POR LOTE</b>', sTCL), Paragraph('<b>RD$853,908</b>', sTCR), Paragraph('<b>RD$669,158</b>', sTCR), Paragraph('<b>RD$669,158</b>', sTCR), Paragraph('<b>RD$669,158</b>', sTCR), Paragraph('<b>RD$2,861,382</b>', sTCR)],
]
cw2 = [AW*0.30, AW*0.14, AW*0.14, AW*0.14, AW*0.14, AW*0.14]
story.append(Spacer(1, 8))
story.append(make_table(inv_cat, cw2, repeat_rows=1))
story.append(Paragraph('Tabla 3. Desglose de inversion inicial por categoria y lote', sCaption))

story.append(Spacer(1, 6))
story.append(Paragraph(
    '<b>Nota:</b> Los gastos fijos operativos (salarios, electricidad, agua, mantenimiento) se suman a la inversion '
    'inicial y totalizan RD$55,000/mes durante los meses 0-4, RD$70,000/mes durante los meses 5-10, y RD$85,000/mes '
    'a partir del mes 11 en adelante. Estos gastos fijos no se incluyen en la tabla anterior pero forman parte integral '
    'del flujo de caja mensual que se detalla en la seccion de operaciones mes a mes.',
    sSmall))

# ========= SECTION 4: INVERSION DE REEMPLAZO =========
story.append(add_heading('<b>4. Inversion de Reemplazo (Ciclo 2)</b>', sH1, 0))
story.append(Paragraph(
    'Cada reemplazo de lote implica una inversion de aproximadamente RD$240,000, que incluye la compra de 2,000 '
    'pollitas nuevas (RD$172,200), el equipo de galpon reutilizable (RD$47,200) y el esquema completo de vacunas '
    'y medicamentos (RD$52,678). Adicionalmente, durante los 5 meses de crianza anterior al inicio de postura, '
    'cada lote consume alimento especializado (Pre-Inicio, Inicio, Crecimiento y Pre-Postura) por un valor '
    'aproximado de RD$82,080. El total de inversion en reemplazos para los 8 lotes del Ciclo 2 asciende a '
    'RD$1,920,000, segun los registros del modelo financiero.',
    sBody))
story.append(Spacer(1, 6))

story.append(Paragraph(
    'El calendario de reemplazos esta disenado para que la produccion nunca se detenga. Las pollitas del Ciclo 2 '
    'se adquieren 2 meses antes de que las gallinas del Ciclo 1 completen sus 20 meses de postura. De esta forma, '
    'cuando las gallinas viejas son vendidas como gallinas de desecho a RD$100 por unidad (generando RD$200,000 '
    'de ingreso por lote), las nuevas pollitas ya tienen 3 meses de edad y estan a solo 2 meses de iniciar su '
    'ciclo productivo. Este solapamiento es la clave de la ventaja competitiva de la Estrategia C.',
    sBody))
story.append(Spacer(1, 8))

repl_data = [
    [Paragraph('<b>Lote</b>', sTH), Paragraph('<b>Venta Ciclo 1</b>', sTH),
     Paragraph('<b>Compra Ciclo 2</b>', sTH), Paragraph('<b>Inicio Postura C2</b>', sTH),
     Paragraph('<b>Ingreso Venta</b>', sTH), Paragraph('<b>Costo Reemplazo</b>', sTH)],
    [Paragraph('Lote 1 (Galpon 1)', sTCL), Paragraph('Mes 25', sTC), Paragraph('Mes 20', sTC), Paragraph('Mes 25', sTC), Paragraph('RD$200,000', sTCR), Paragraph('~RD$240,000', sTCR)],
    [Paragraph('Lote 2 (Galpon 2)', sTCL), Paragraph('Mes 27', sTC), Paragraph('Mes 22', sTC), Paragraph('Mes 27', sTC), Paragraph('RD$200,000', sTCR), Paragraph('~RD$240,000', sTCR)],
    [Paragraph('Lote 3 (Galpon 3)', sTCL), Paragraph('Mes 29', sTC), Paragraph('Mes 24', sTC), Paragraph('Mes 29', sTC), Paragraph('RD$200,000', sTCR), Paragraph('~RD$240,000', sTCR)],
    [Paragraph('Lote 4 (Galpon 4)', sTCL), Paragraph('Mes 31', sTC), Paragraph('Mes 26', sTC), Paragraph('Mes 31', sTC), Paragraph('RD$200,000', sTCR), Paragraph('~RD$240,000', sTCR)],
]
cw3 = [AW*0.22, AW*0.16, AW*0.16, AW*0.16, AW*0.16, AW*0.16]
story.append(make_table(repl_data, cw3, repeat_rows=1))
story.append(Paragraph('Tabla 4. Calendario de reemplazos del Ciclo 1 al Ciclo 2', sCaption))

# ========= SECTION 5: OPERACIONES MES A MES =========
story.append(add_heading('<b>5. Manual de Operaciones Mes por Mes</b>', sH1, 0))
story.append(Paragraph(
    'A continuacion se presenta la guia operativa detallada para cada uno de los 60 meses de la proyeccion. '
    'Cada mes incluye el estado de los lotes activos, las acciones requeridas, las inversiones necesarias, '
    'los ingresos proyectados y los costos operativos. La informacion se organiza en fases operativas para '
    'facilitar la planificacion y ejecucion.',
    sBody))
story.append(Spacer(1, 12))

# ---- Helper functions for month-by-month ----
def phase_title(num, title, months_range):
    return add_heading(f'<b>5.{num} {title} (Meses {months_range})</b>', sH2, 1)

def month_entry(d):
    """Generate a month entry description."""
    m = d['m']
    rev = d['rev']
    cost = d['cost']
    cum = d['cum']
    egg_rev = d.get('eggRev', rev)
    hen_sale = d.get('henSale', 0)
    laying = d.get('layingBatches', 0)
    
    parts = []
    # Determine activities
    if m == 0:
        parts.append('Compra de 2,000 pollitas Lote 1 + construccion galpon principal, almacen y bomba de agua.')
    elif m == 1:
        parts.append('Lote 1 en fase Pre-Inicio (semana 1-4). Alimentacion especializada. Monitoreo sanitario.')
    elif m == 2:
        parts.append('Compra de 2,000 pollitas Lote 2 + inicio de construccion galpon 2. Lote 1 en fase Inicio.')
    elif m == 3:
        parts.append('Lotes 1 y 2 en crecimiento. Vacunacion Newcastle + Bronquitis. Verificacion de bioseguridad.')
    elif m == 4:
        parts.append('Compra de 2,000 pollitas Lote 3. Lote 1 entra en pre-postura (semana 16). Lote 2 en fase Crecimiento.')
    elif m == 5:
        parts.append('INICIO DE POSTURA LOTE 1. Primer mes de produccion. Lote 4 llega (compra). Lote 2 en pre-postura.')
    elif m == 6:
        parts.append('Lote 1 en postura plena. Compra Lote 4. Lote 2 inicia postura. Gastos fijos aumentan a RD$70,000.')
    elif m == 7:
        parts.append('Lotes 1 y 2 en postura. Lote 3 en pre-postura. Lote 4 en fase Inicio.')
    elif m == 8:
        parts.append('Lotes 1 y 2 en postura. Lote 3 inicia postura. Lote 4 en fase Crecimiento.')
    elif m == 9:
        parts.append('Lotes 1, 2 y 3 en postura. Lote 4 en pre-postura. Gastos fijos suben a RD$85,000.')
    elif m == 10:
        parts.append('Lotes 1, 2 y 3 en postura. Lote 4 inicia postura. Todos los galpones activos en pre-postura/postura.')
    elif m == 11:
        parts.append('OPERACION PLENA: Los 4 lotes en postura. Ingreso maximo RD$1,056,000/mes.')
    elif 11 < m <= 24:
        parts.append(f'Operacion plena: {laying} lotes en postura. Produccion estable.')
    elif m == 20:
        parts.append('CRUCIAL: Comprar pollitas de reemplazo Lote 1 Ciclo 2 (2,000 aves). Inicio del solapamiento.')
    elif m == 22:
        parts.append('Comprar pollitas de reemplazo Lote 2 Ciclo 2. Lote 1 C2 en fase Inicio.')
    elif m == 24:
        parts.append('Comprar pollitas de reemplazo Lote 3 Ciclo 2. Lote 1 C1 finaliza 20 meses de postura.')
    elif m == 25:
        parts.append('VENTA Lote 1 C1 (2,000 gallinas desecho = RD$200,000). Lote 1 C2 inicia postura.')
    elif m == 26:
        parts.append('Comprar pollitas de reemplazo Lote 4 Ciclo 2. Lote 2 C1 finaliza postura.')
    elif m == 27:
        parts.append('VENTA Lote 2 C1 (2,000 gallinas = RD$200,000). Lote 2 C2 inicia postura. Produccion continua.')
    elif m == 29:
        parts.append('VENTA Lote 3 C1 (2,000 gallinas = RD$200,000). Lote 3 C2 inicia postura.')
    elif m == 31:
        parts.append('VENTA Lote 4 C1 (2,000 gallinas = RD$200,000). Lote 4 C2 inicia postura. CICLO 2 COMPLETO.')
    elif 31 < m <= 39:
        parts.append(f'Operacion plena Ciclo 2: 4 lotes en postura. Produccion estable.')
    elif m == 40:
        parts.append('CRUCIAL: Comprar pollitas Ciclo 3 Lote 1 (si se extiende). Reemplazo anticipado inicio.')
    elif m == 42:
        parts.append('Comprar pollitas Ciclo 3 Lote 2.')
    elif m == 44:
        parts.append('Comprar pollitas Ciclo 3 Lote 3. Lote 1 C2 finaliza 20 meses de postura.')
    elif m == 45:
        parts.append('VENTA Lote 1 C2 (2,000 gallinas = RD$200,000). Lote 1 C3 inicia postura.')
    elif m == 46:
        parts.append('Comprar pollitas Ciclo 3 Lote 4.')
    elif m == 47:
        parts.append('VENTA Lote 2 C2 (2,000 gallinas = RD$200,000). Lote 2 C3 inicia postura.')
    elif m == 49:
        parts.append('VENTA Lote 3 C2 (2,000 gallinas = RD$200,000). Lote 3 C3 inicia postura.')
    elif m == 51:
        parts.append('VENTA Lote 4 C2 (2,000 gallinas = RD$200,000). Lote 4 C3 inicia postura. CICLO 3 EN MARCHA.')
    elif 51 < m <= 59:
        parts.append(f'Operacion plena: {laying} lotes en postura Ciclo 3. Produccion estable.')
    else:
        parts.append(f'{laying} lote(s) en postura. Operacion de rutina.')
    
    # Add financial summary
    fin_parts = []
    if rev > 0:
        fin_parts.append(f'Ingresos: {fmt(rev)}')
    if hen_sale > 0:
        fin_parts.append(f'Venta gallinas: {fmt(hen_sale)}')
    fin_parts.append(f'Costos: {fmt(cost)}')
    fin_parts.append(f'Flujo acumulado: {fmt(cum)}')
    
    return parts[0], ' | '.join(fin_parts)

# Create month-by-month data organized by phase
phases = [
    ("Fase 1: Instalacion y Crianza", "0-4", range(0, 5)),
    ("Fase 2: Arranque de Produccion", "5-10", range(5, 11)),
    ("Fase 3: Operacion Plena Ciclo 1", "11-24", range(11, 25)),
    ("Fase 4: Transicion Ciclo 1 a Ciclo 2", "25-31", range(25, 32)),
    ("Fase 5: Operacion Plena Ciclo 2", "32-39", range(32, 40)),
    ("Fase 6: Transicion Ciclo 2 a Ciclo 3", "40-51", range(40, 52)),
    ("Fase 7: Operacion Plena Ciclo 3", "52-59", range(52, 60)),
]

for phase_num, (phase_name, months_str, month_range) in enumerate(phases, 1):
    story.append(phase_title(phase_num, phase_name, months_str))
    
    # Phase description
    phase_descs = {
        "Fase 1": "Esta fase inicial abarca la construccion de la infraestructura de la granja y la adquisicion escalonada de los 4 lotes de pollitas WD80. Se invierte el 80% del capital inicial en galpones, equipo y aves. No hay ingresos por venta de huevos durante estos primeros 5 meses, ya que las aves atraviesan las fases de Pre-Inicio, Inicio, Crecimiento y Pre-Postura. La gestion financiera debe asegurar liquidez suficiente para cubrir los gastos de alimentacion especializada, vacunacion y gastos fijos.",
        "Fase 2": "Marcada por el inicio de la postura del Lote 1 (mes 5) y la incorporacion progresiva de los Lotes 2, 3 y 4 a la produccion. Los ingresos comienzan a fluir de forma escalonada, alcanzando operacion plena de 4 lotes al final de esta fase. Los gastos fijos aumentan a RD$70,000/mes reflejando la mayor actividad operativa. El flujo de caja sigue siendo negativo pero la tendencia muestra una desaceleracion en el deficit acumulado.",
        "Fase 3": "La fase mas estable y rentable del primer ciclo. Los 4 lotes producen simultaneamente, generando ingresos mensuales de RD$1,056,000. El punto de equilibrio se alcanza en el mes 19, momento a partir del cual el flujo de caja acumulado se torna positivo de forma permanente. A partir del mes 20, se inicia la compra anticipada de pollitas de reemplazo para el Ciclo 2, lo que incrementa los costos mensuales pero garantiza la continuidad productiva.",
        "Fase 4": "Periodo critico de transicion donde se ejecuta la venta de las gallinas del Ciclo 1 (4 lotes x RD$200,000 = RD$800,000 en ingresos por desecho) y se completa la incorporacion de los lotes del Ciclo 2 a la produccion. Gracias a la cria anticipada, la produccion nunca se detiene: cada lote nuevo inicia postura exactamente cuando el lote viejo se vende. Esta sincronizacion perfecta es el nucleo de la ventaja competitiva de la Estrategia C.",
        "Fase 5": "Segundo periodo de operacion plena con los 4 lotes del Ciclo 2 en produccion simultanea. Los ingresos mensuales se estabilizan en RD$1,056,000. El flujo de caja acumulado crece de forma sostenida, superando los RD$8 millones al cierre de esta fase. La gestion operativa se centra en mantener los estandares de alimentacion, sanidad y bioseguridad para maximizar la duracion del ciclo productivo.",
        "Fase 6": "Segunda ronda de reemplazos, replicando el esquema del Ciclo 1. Se venden los lotes del Ciclo 2 y se incorporan los del Ciclo 3 con la misma logica de cria anticipada. Se generan RD$800,000 adicionales por venta de gallinas de desecho. La operacion continua sin interrupciones, demostrando la sostenibilidad del modelo a largo plazo.",
        "Fase 7": "Tercer ciclo de operacion plena. Al cierre del mes 59, el flujo de caja acumulado alcanza RD$15.6 millones. Esta fase demuestra que la Estrategia C es un modelo de negocio autosostenible y escalable, con retornos crecientes por ciclo gracias a la eliminacion completa de periodos muertos entre reemplazos.",
    }
    
    for phase_key, desc in phase_descs.items():
        if phase_name.startswith(phase_key.split(":")[0]):
            story.append(Paragraph(desc, sBody))
            story.append(Spacer(1, 8))
            break
    
    # Month-by-month table for this phase
    tbl_header = [
        Paragraph('<b>Mes</b>', sTH),
        Paragraph('<b>Ingresos</b>', sTH),
        Paragraph('<b>Costos</b>', sTH),
        Paragraph('<b>Flujo Acumulado</b>', sTH),
        Paragraph('<b>Acciones Principales</b>', sTH),
    ]
    tbl_data = [tbl_header]
    
    phase_months = [monthly[m] for m in month_range]
    for d in phase_months:
        desc_text, fin_text = month_entry(d)
        # Truncate description to fit
        if len(desc_text) > 90:
            desc_text = desc_text[:87] + '...'
        tbl_data.append([
            Paragraph(f'<b>{d["m"]}</b>', sTC),
            Paragraph(fmt(d['rev']), sTCR),
            Paragraph(fmt(d['cost']), sTCR),
            Paragraph(fmt(d['cum']), sTCR),
            Paragraph(desc_text, sTCL),
        ])
    
    cw4 = [AW*0.07, AW*0.17, AW*0.17, AW*0.20, AW*0.39]
    story.append(make_table(tbl_data, cw4, repeat_rows=1))
    story.append(Paragraph(f'Tabla 5.{phase_num}. Operaciones detalladas - {phase_name} (Meses {months_str})', sCaption))
    story.append(Spacer(1, 14))

# ========= SECTION 6: GRAFICOS =========
story.append(add_heading('<b>6. Analisis Grafico</b>', sH1, 0))
story.append(Paragraph(
    'Los siguientes graficos ilustran el comportamiento financiero de la Estrategia C a lo largo de los 60 meses '
    'de proyeccion, permitiendo visualizar la evolucion de ingresos, costos, flujo de caja acumulado y la '
    'distribucion de la inversion total.',
    sBody))
story.append(Spacer(1, 12))

# Chart: Cash Flow
img_dir = '/home/z/my-project/download/'
for chart_file, chart_caption in [
    ('chart_c_cashflow.png', 'Figura 1. Flujo mensual de caja: ingresos vs costos con marcadores de venta de gallinas'),
    ('chart_c_cumulative.png', 'Figura 2. Flujo de caja acumulado con indicacion del punto de equilibrio (Mes 19)'),
    ('chart_c_timeline.png', 'Figura 3. Cronograma de operaciones: Ciclo 1 y Ciclo 2 (fases de cria y postura)'),
    ('chart_c_annual.png', 'Figura 4. Resultados anuales: ingresos por huevos, venta de gallinas y beneficio neto'),
    ('chart_c_investment.png', 'Figura 5. Desglose de la inversion total por categoria'),
]:
    img_path = os.path.join(img_dir, chart_file)
    if os.path.exists(img_path):
        from reportlab.lib.utils import ImageReader
        img = Image(img_path, width=AW, height=AW*0.4)
        story.append(img)
        story.append(Paragraph(chart_caption, sCaption))
        story.append(Spacer(1, 12))

# ========= SECTION 7: TABLA FINANCIERA COMPLETA =========
story.append(add_heading('<b>7. Tabla Financiera Completa (60 Meses)</b>', sH1, 0))
story.append(Paragraph(
    'La siguiente tabla presenta el desglose financiero mes a mes de la Estrategia C, incluyendo ingresos totales, '
    'desglose entre venta de huevos y venta de gallinas, costos operativos totales y flujo de caja acumulado. '
    'Esta tabla constituye la referencia maestra para el seguimiento financiero de la operacion.',
    sBody))
story.append(Spacer(1, 10))

# Full financial table (compact)
fin_header = [
    Paragraph('<b>Mes</b>', sTH),
    Paragraph('<b>Ingreso Huevos</b>', sTH),
    Paragraph('<b>Venta Gallinas</b>', sTH),
    Paragraph('<b>Ingreso Total</b>', sTH),
    Paragraph('<b>Costos</b>', sTH),
    Paragraph('<b>Flujo Acum.</b>', sTH),
]
fin_data = [fin_header]
for d in monthly:
    er = d.get('eggRev', d['rev'])
    hs = d.get('henSale', 0)
    fin_data.append([
        Paragraph(f'<b>{d["m"]}</b>', sTC),
        Paragraph(fmt(er), sTCR),
        Paragraph(fmt(hs), sTCR),
        Paragraph(fmt(d['rev']), sTCR),
        Paragraph(fmt(d['cost']), sTCR),
        Paragraph(fmt(d['cum']), sTCR),
    ])

cw5 = [AW*0.06, AW*0.19, AW*0.17, AW*0.18, AW*0.19, AW*0.21]
story.append(make_table(fin_data, cw5, repeat_rows=1))
story.append(Paragraph('Tabla 6. Flujo financiero completo mes a mes - Estrategia C (60 meses)', sCaption))

# ========= SECTION 8: INSTRUCCIONES DE EJECUCION =========
story.append(add_heading('<b>8. Instrucciones de Ejecucion y Protocolos</b>', sH1, 0))

story.append(add_heading('<b>8.1 Protocolo de Compra de Aves</b>', sH2, 1))
story.append(Paragraph(
    'La adquisicion de pollitas WD80 debe realizarse exclusivamente a proveedores certificados con historial '
    'comprobado de sanidad aviar. Cada lote de 2,000 pollitas debe adquiririrse con un peso promedio minimo '
    'de 35 gramos al dia de nacimiento, verificar el esquema de vacunacion basal del incubadora y solicitar '
    'certificado veterinario de libre de Salmonella pullorum y Mycoplasma gallisepticum. El transporte debe '
    'realizarse en cajas ventiladas con densidad maxima de 100 aves por caja, evitando tiempos de traslado '
    'superiores a 6 horas. Al llegar a la granja, las pollitas deben recibir agua con electrolitos y vitaminas '
    'durante las primeras 8 horas antes de iniciar el alimento de Pre-Inicio.',
    sBody))
story.append(Spacer(1, 8))

story.append(add_heading('<b>8.2 Esquema de Alimentacion por Fase</b>', sH2, 1))
feed_data = [
    [Paragraph('<b>Fase</b>', sTH), Paragraph('<b>Semanas</b>', sTH), Paragraph('<b>Alimento</b>', sTH), Paragraph('<b>Consumo Est.</b>', sTH), Paragraph('<b>Costo/mes (2,000 aves)</b>', sTH)],
    [Paragraph('Pre-Inicio', sTCL), Paragraph('0-4', sTC), Paragraph('Pre-Inicio (iniciacion)', sTCL), Paragraph('12 g/ave/dia', sTC), Paragraph('~RD$7,200', sTCR)],
    [Paragraph('Inicio', sTCL), Paragraph('4-8', sTC), Paragraph('Inicio (crecimiento inicial)', sTCL), Paragraph('28 g/ave/dia', sTC), Paragraph('~RD$16,800', sTCR)],
    [Paragraph('Crecimiento', sTCL), Paragraph('8-14', sTC), Paragraph('Crecimiento (desarrollo)', sTCL), Paragraph('58 g/ave/dia', sTC), Paragraph('~RD$34,800', sTCR)],
    [Paragraph('Pre-Postura', sTCL), Paragraph('14-18', sTC), Paragraph('Pre-Postura (transicion)', sTCL), Paragraph('85 g/ave/dia', sTC), Paragraph('~RD$23,280', sTCR)],
    [Paragraph('<b>Postura</b>', sTCL), Paragraph('<b>18+</b>', sTC), Paragraph('<b>Postura (Nutriovo Sanut +5%)</b>', sTCL), Paragraph('<b>~115 g/ave/dia</b>', sTC), Paragraph('<b>~RD$120,000</b>', sTCR)],
]
cw6 = [AW*0.14, AW*0.10, AW*0.30, AW*0.18, AW*0.28]
story.append(make_table(feed_data, cw6, repeat_rows=1))
story.append(Paragraph('Tabla 7. Esquema de alimentacion por fase productiva (2,000 aves)', sCaption))

story.append(Spacer(1, 8))
story.append(Paragraph(
    'El alimento debe proveerse a traves de proveedores confiables que garanticen la formula Nutriovo Sanut '
    'con el ajuste de precio del +5%. Se recomienda mantener un inventario minimo de 2 semanas de alimento '
    'en el almacen para evitar desabastecimiento. El alimento de postura (80 qq/mes por lote) se compra a '
    'RD$1,500 por quintal, totalizando RD$120,000 mensuales por lote en produccion.',
    sBody))
story.append(Spacer(1, 8))

story.append(add_heading('<b>8.3 Protocolo Sanitario y Vacunacion</b>', sH2, 1))
story.append(Paragraph(
    'El programa sanitario es critico para mantener la tasa de postura del 80% y la salud general del lote. '
    'El esquema de vacunacion incluye las siguientes aplicaciones obligatorias, administradas por un veterinario '
    'certificado bajo estrictas normas de bioseguridad. Toda vacuna debe almacenarse entre 2-8 grados centigrados '
    'y aplicarse siguiendo las indicaciones del fabricante en cuanto a dosis, via de administracion y periodicidad. '
    'El costo total del esquema vacunal por lote asciende a RD$52,678 y cubre las 5 semanas de aplicacion.',
    sBody))
story.append(Spacer(1, 6))

vac_data = [
    [Paragraph('<b>Semana</b>', sTH), Paragraph('<b>Vacuna</b>', sTH), Paragraph('<b>Via</b>', sTH), Paragraph('<b>Objetivo</b>', sTH)],
    [Paragraph('1', sTC), Paragraph('Newcastle + Bronquitis (viva)', sTCL), Paragraph('Ocular', sTC), Paragraph('Proteccion respiratoria inicial', sTCL)],
    [Paragraph('2', sTC), Paragraph('Gumboro (viva)', sTCL), Paragraph('Agua de bebida', sTC), Paragraph('Inmunosupresion - Gumboro', sTCL)],
    [Paragraph('3', sTC), Paragraph('Newcastle + Bronquitis (refuerzo)', sTCL), Paragraph('Ocular', sTC), Paragraph('Refuerzo inmunidad respiratoria', sTCL)],
    [Paragraph('4', sTC), Paragraph('Gumboro (refuerzo)', sTCL), Paragraph('Agua de bebida', sTC), Paragraph('Refuerzo Gumboro', sTCL)],
    [Paragraph('5', sTC), Paragraph('Viruela Aviar + Encefalomielitis', sTCL), Paragraph('Puncion alar', sTC), Paragraph('Enfermedades cutaneas y neurologicas', sTCL)],
    [Paragraph('8', sTC), Paragraph('Newcastle + Bronquitis (inactivada)', sTCL), Paragraph('Intramuscular', sTC), Paragraph('Inmunidad prolongada', sTCL)],
    [Paragraph('10', sTC), Paragraph('Coriza Infeccioso', sTCL), Paragraph('Intramuscular', sTC), Paragraph('Proteccion respiratoria superior', sTCL)],
    [Paragraph('12', sTC), Paragraph('Newcastle + Bronquitis (refuerzo 2)', sTCL), Paragraph('Agua de bebida', sTC), Paragraph('Mantenimiento inmunidad', sTCL)],
    [Paragraph('16', sTC), Paragraph('E. coli + Salmonella', sTCL), Paragraph('Intramuscular', sTC), Paragraph('Proteccion bacteriana', sTCL)],
]
cw7 = [AW*0.10, AW*0.30, AW*0.18, AW*0.42]
story.append(make_table(vac_data, cw7, repeat_rows=1))
story.append(Paragraph('Tabla 8. Esquema de vacunacion completo por lote WD80', sCaption))

story.append(Spacer(1, 8))

story.append(add_heading('<b>8.4 Protocolo de Venta de Gallinas de Desecho</b>', sH2, 1))
story.append(Paragraph(
    'Al completar los 20 meses de postura, cada lote de 2,000 gallinas se vende como gallina de desecho a un '
    'precio de RD$100 por unidad, generando RD$200,000 de ingreso por lote. El proceso de venta debe planificarse '
    'con al menos 2 semanas de anticipacion, coordinando con intermediarios locales o plantas de procesamiento. '
    'Antes de la venta, las aves deben someterse a un periodo de ayuno de 8-12 horas para facilitar el manejo '
    'y el transporte. El galpon debe limpiarse y desinfectarse completamente antes de recibir al nuevo lote de '
    'pollitas de reemplazo, siguiendo un protocolo de lavado a presion, aplicacion de desinfectante y tiempo '
    'de vacio sanitario minimo de 7 dias.',
    sBody))
story.append(Spacer(1, 8))

story.append(add_heading('<b>8.5 Control de Calidad y KPIs de Seguimiento</b>', sH2, 1))
story.append(Paragraph(
    'Para garantizar que la operacion se mantenga alineada con las proyecciones financieras, se recomienda '
    'monitorear los siguientes indicadores clave de rendimiento (KPIs) de forma mensual. Cualquier desviacion '
    'superior al 10% respecto a los valores objetivo debe triggers una revision operativa inmediata para '
    'identificar y corregir la causa raiz.',
    sBody))
story.append(Spacer(1, 6))

kpi_ops = [
    [Paragraph('<b>KPI</b>', sTH), Paragraph('<b>Objetivo</b>', sTH), Paragraph('<b>Frecuencia</b>', sTH), Paragraph('<b>Accion si desvia</b>', sTH)],
    [Paragraph('Tasa de postura', sTCL), Paragraph('80% promedio', sTC), Paragraph('Diaria', sTC), Paragraph('Revisar alimento, agua, temperatura, iluminacion', sTCL)],
    [Paragraph('Mortalidad', sTCL), Paragraph('< 0.5% mensual', sTC), Paragraph('Semanal', sTC), Paragraph('Necropsia, revisar bioseguridad, vacunacion', sTCL)],
    [Paragraph('Consumo de alimento', sTCL), Paragraph('115 g/ave/dia (postura)', sTC), Paragraph('Semanal', sTC), Paragraph('Ajustar formulacion, verificar calidad', sTCL)],
    [Paragraph('Peso del huevo', sTCL), Paragraph('60-64 g promedio', sTC), Paragraph('Semanal', sTC), Paragraph('Revisar nutricion, edad del lote', sTCL)],
    [Paragraph('Conversion alimenticia', sTCL), Paragraph('2.1-2.3 kg alimento/docena', sTC), Paragraph('Mensual', sTC), Paragraph('Analizar desperdicio, densidad calórica', sTCL)],
    [Paragraph('Gravedad especifica', sTCL), Paragraph('1.080+', sTC), Paragraph('Semanal', sTC), Paragraph('Suplementar calcio, vitamina D3', sTCL)],
    [Paragraph('Flujo de caja mensual', sTCL), Paragraph('Segun proyeccion', sTC), Paragraph('Mensual', sTC), Paragraph('Revisar costos, precio de venta, volumenes', sTCL)],
]
cw8 = [AW*0.22, AW*0.22, AW*0.15, AW*0.41]
story.append(make_table(kpi_ops, cw8, repeat_rows=1))
story.append(Paragraph('Tabla 9. KPIs de seguimiento operativo y financiero', sCaption))

# ========= SECTION 9: RESUMEN COMPARATIVO =========
story.append(add_heading('<b>9. Comparativo de Estrategias</b>', sH1, 0))
story.append(Paragraph(
    'La siguiente tabla compara los resultados de las tres estrategias evaluadas durante la fase de analisis, '
    'confirmando la superioridad de la Estrategia C en todos los indicadores financieros clave. Este comparativo '
    'sirve como justificacion definitiva para la seleccion de la Estrategia C como plan operativo a implementar.',
    sBody))
story.append(Spacer(1, 10))

comp_data = [
    [Paragraph('<b>Indicador</b>', sTH), Paragraph('<b>Estrategia A</b>', sTH), Paragraph('<b>Estrategia B</b>', sTH), Paragraph('<b>Estrategia C</b>', sTH)],
]
metrics = data['comparison']['metrics']
for m in metrics:
    comp_data.append([
        Paragraph(m[0], sTCL),
        Paragraph(str(m[1]) if not isinstance(m[1], str) else m[1], sTCR),
        Paragraph(str(m[2]) if not isinstance(m[2], str) else m[2], sTCR),
        Paragraph(f'<b>{str(m[3]) if not isinstance(m[3], str) else m[3]}</b>', sTCR),
    ])

cw9 = [AW*0.38, AW*0.20, AW*0.21, AW*0.21]
story.append(make_table(comp_data, cw9, repeat_rows=1))
story.append(Paragraph('Tabla 10. Comparativo de las 3 estrategias evaluadas', sCaption))

# ========= SECTION 10: RECOMENDACIONES FINALES =========
story.append(add_heading('<b>10. Recomendaciones Finales</b>', sH1, 0))

story.append(Paragraph(
    'La Estrategia C demuestra ser el modelo operativo mas rentable y sostenible para Granja Gallinas WD80. '
    'Sin embargo, la ejecucion exitosa requiere disciplina operativa y atencion a los siguientes puntos criticos:',
    sBody))
story.append(Spacer(1, 6))

recommendations = [
    ('<b>Gestion de liquidez inicial:</b> El deficit maximo de RD$4.46 millones se presenta en el mes 8, antes de que '
     'los 4 lotes entren en produccion plena. Asegurar una linea de credito o reserva de efectivo de al menos RD$5 millones '
     'es fundamental para cubrir los costos operativos durante esta fase de inversion.'),
    ('<b>Puntualidad en los reemplazos:</b> El exito de la Estrategia C depende de comprar las pollitas de reemplazo '
     'exactamente 2 meses antes de la venta de gallinas. Un retraso de 1 mes en la compra puede generar hasta 3 meses '
     'sin produccion por lote, reduciendo significativamente los ingresos acumulados.'),
    ('<b>Control de calidad del alimento:</b> El alimento representa el 70-80% de los costos variables. Negociar '
     'contratos a largo plazo con proveedores de Nutriovo Sanut puede garantizar precios estables y calidad consistente, '
     'protegiendo los margenes de rentabilidad ante fluctuaciones del mercado.'),
    ('<b>Monitoreo sanitario preventivo:</b> Implementar un programa estricto de bioseguridad con control de acceso, '
     'desinfeccion de vehiculos y cuarentena para aves nuevas. Un brote de Newcastle o Influenza Aviar puede reducir la '
     'produccion hasta un 80% durante 4-6 semanas.'),
    ('<b>Diversificacion de canales de venta:</b> No depender de un unico comprador para los huevos. Desarrollar '
     'relaciones con al menos 3-5 distribuidores y explorar canales directos (ferias, mercados locales, restaurantes) '
     'para negociar mejores precios y reducir la dependencia de intermediarios.'),
    ('<b>Reinversion de utilidades:</b> Durante los meses de mayor superavit (meses 32-51), se recomienda destinar '
     'al menos el 20% de las utilidades netas a un fondo de contingencia y el 30% a mejoras de infraestructura '
     '(sistemas de ventilacion, automatizacion de alimentacion, energia solar).'),
]

for rec in recommendations:
    story.append(Paragraph(f'- {rec}', sBullet))

# ========= BUILD PDF =========
output_body = '/home/z/my-project/download/manual_c_body.pdf'
output_cover = '/home/z/my-project/download/cover_c.pdf'
output_final = '/home/z/my-project/download/Manual_Operativo_Estrategia_C_WD80.pdf'

doc = TocDocTemplate(output_body, pagesize=A4,
    leftMargin=LM, rightMargin=RM, topMargin=TM, bottomMargin=BM,
    title='Manual Operativo - Estrategia C Granja WD80',
    author='Z.ai', creator='Z.ai',
    subject='Manual operativo paso a paso para la implementacion de la Estrategia C')

doc.multiBuild(story)
print(f"Body PDF generated: {output_body}")

# ========= MERGE COVER + BODY =========
A4_W, A4_H = 595.28, 841.89

def normalize_page(page):
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    if abs(w - A4_W) > 2 or abs(h - A4_H) > 2:
        sx, sy = A4_W / w, A4_H / h
        page.add_transformation(Transformation().scale(sx=sx, sy=sy))
        page.mediabox.lower_left = (0, 0)
        page.mediabox.upper_right = (A4_W, A4_H)
    return page

reader_body = PdfReader(output_body)
reader_cover = PdfReader(output_cover)
writer = PdfWriter()

# Cover first
cover_page = reader_cover.pages[0]
writer.add_page(normalize_page(cover_page))

# Then body pages
for page in reader_body.pages:
    writer.add_page(normalize_page(page))

writer.add_metadata({
    '/Title': 'Manual Operativo - Estrategia C Granja Gallinas WD80',
    '/Author': 'Z.ai',
    '/Creator': 'Z.ai',
    '/Subject': 'Manual paso a paso para la Estrategia de mayor rentabilidad avicola'
})

with open(output_final, 'wb') as f:
    writer.write(f)

print(f"Final PDF generated: {output_final}")
print(f"Total pages: {len(reader_cover.pages) + len(reader_body.pages)}")

# Cleanup
import os
os.remove(output_body) if os.path.exists(output_body) else None
os.remove(output_cover) if os.path.exists(output_cover) else None

