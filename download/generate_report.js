const { Document, Packer, Paragraph, TextRun, ImageRun, Header, Footer,
        AlignmentType, HeadingLevel, PageNumber, PageBreak, TableOfContents,
        Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
        SectionType, NumberFormat, TabStopType, TabStopPosition } = require("docx");
const fs = require("fs");
const path = require("path");
const { imageSize } = require("image-size");

// ── PATHS ──
const OUT = "/home/z/my-project/download";
const DOCX_OUT = path.join(OUT, "Resumen_Ejecutivo_Granja_WD80.docx");

// ── PALETTE: FG-1 Forest Mint (Agriculture) ──
const P = {
  primary: "1C2C28",
  body: "1C2C28",
  secondary: "5A7068",
  accent: "2A7A65",
  surface: "EDF5F2",
  table: {
    headerBg: "2A7A65",
    headerText: "FFFFFF",
    accentLine: "2A7A65",
    innerLine: "C5D8D0",
    surface: "EDF5F2",
  }
};

const c = (hex) => hex.replace("#", "");

// ── BORDERS ──
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine };
const headerBottomBorder = { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine };
const tableTopBorder = { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine };
const tableBottomBorder = { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine };

// ── IMAGE HELPERS ──
function embedImage(filename) {
  const buf = fs.readFileSync(path.join(OUT, filename));
  const dims = imageSize(buf);
  const maxW = 460;
  const maxH = 280;
  let w = maxW;
  let h = Math.round(w * (dims.height / dims.width));
  if (h > maxH) { h = maxH; w = Math.round(h * (dims.width / dims.height)); }
  return {
    data: buf,
    transformation: { width: w, height: h },
    type: "png",
  };
}

function chartPara(filename) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 100 },
    children: [new ImageRun(embedImage(filename))],
  });
}

// ── CALC TITLE LAYOUT ──
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 20;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    const cpl = charsPerLine(minPt);
    lines = splitTitleLines(title, cpl);
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([
    ...' ', '-', '/', ',', '.', ':', ';',
  ]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) { breakAt = charsPerLine; }
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}

function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = true, metaLineCount = 3, fixedHeight = 400 } = params;
  const SAFETY = 1200;
  const usableHeight = 16838 - SAFETY;
  const titleHeight = titleLineCount * titlePt * 23;
  const subtitleHeight = hasSubtitle ? 400 : 0;
  const metaHeight = metaLineCount * 300;
  const contentHeight = titleHeight + subtitleHeight + metaHeight + fixedHeight;
  const remaining = usableHeight - contentHeight;
  const topSpacing = Math.min(5000, Math.max(1200, Math.round(remaining * 0.55)));
  return { topSpacing };
}

// ── FORMAT HELPERS ──
function fmtRD(n) {
  const a = Math.round(Math.abs(n));
  return (n < 0 ? "-RD$" : "RD$") + a.toLocaleString("en");
}

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true, font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 32, color: c(P.primary) })],
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, bold: true, font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 28, color: c(P.primary) })],
  });
}

function bodyPara(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 312, after: 80 },
    children: [new TextRun({ text, size: 24, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, color: c(P.body) })],
  });
}

function bodyParaBold(boldText, normalText) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 312, after: 80 },
    children: [
      new TextRun({ text: boldText, bold: true, size: 24, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, color: c(P.body) }),
      new TextRun({ text: normalText, size: 24, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, color: c(P.body) }),
    ],
  });
}

function captionPara(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 160 },
    children: [new TextRun({ text, italics: true, size: 21, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, color: c(P.secondary) })],
  });
}

// ── TABLE HELPERS ──
function tableHeaderCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: P.table.headerBg },
    borders: {
      top: NB, left: NB, right: NB,
      bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.headerBg },
    },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: 21, color: P.table.headerText, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
    })],
  });
}

function tableDataCell(text, width, isAlt = false, align = AlignmentType.CENTER, bold = false) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: isAlt ? { type: ShadingType.CLEAR, fill: P.table.surface } : { type: ShadingType.CLEAR, fill: "FFFFFF" },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      left: NB, right: NB,
    },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({ text, size: 21, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, bold })],
    })],
  });
}

function tableTotalCell(text, width, bold = false) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: P.table.surface },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      left: NB, right: NB,
    },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: 21, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
    })],
  });
}

// ── COVER R1: Pure Paragraph Left ──
function buildCover() {
  const title = "Resumen Ejecutivo: Desglose de Gastos e Ingresos";
  const subtitle = "Proyeccion Financiera a 3 Anos";
  const availableWidth = 11906 - 0 - 0 - 200; // page width minus margins minus padding
  const { titlePt, titleLines } = calcTitleLayout(title, availableWidth, 36, 26);
  const { topSpacing } = calcCoverSpacing({
    titleLineCount: titleLines.length,
    titlePt,
    hasSubtitle: true,
    metaLineCount: 3,
    fixedHeight: 400,
  });

  const titleLineSpacing = Math.ceil(titlePt * 23);
  const titleRunProps = {
    bold: true,
    font: { ascii: "Times New Roman", eastAsia: "SimHei" },
    size: titlePt * 2,
    color: P.table.headerText,
  };

  const children = [
    // Spacing
    new Paragraph({ spacing: { before: topSpacing }, children: [] }),
    // Title
    ...titleLines.map((line, i) => new Paragraph({
      spacing: { after: i === titleLines.length - 1 ? 120 : 40, line: titleLineSpacing, lineRule: "atLeast" },
      children: [new TextRun({ text: line, ...titleRunProps })],
    })),
    // Subtitle
    new Paragraph({
      spacing: { before: 200, after: 300, line: 400, lineRule: "atLeast" },
      children: [new TextRun({
        text: subtitle,
        font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
        size: 28, color: P.table.headerText, italics: true,
      })],
    }),
    // Accent line
    new Paragraph({
      indent: { left: 1000, right: 1000 },
      border: { top: { style: BorderStyle.SINGLE, size: 12, color: P.table.headerBg, space: 20 } },
      children: [],
    }),
    // Meta info
    new Paragraph({
      spacing: { before: 300, after: 80 },
      children: [new TextRun({ text: "Granja de Gallinas WD80", size: 24, color: "B0B8C0", font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: "San Jose de los Llanos, Republica Dominicana", size: 22, color: "90989F", font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: "Abril 2026", size: 22, color: "90989F", font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
    }),
  ];

  // Wrapper table (R1: full-page bg, left-aligned content)
  return new Table({
    borders: allNoBorders,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      verticalAlign: "top",
      children: [new TableCell({
        borders: allNoBorders,
        shading: { type: ShadingType.CLEAR, fill: "0C1F1A" },
        margins: { top: 0, bottom: 0, left: 1200, right: 1200 },
        width: { size: 100, type: WidthType.PERCENTAGE },
        children,
      })],
    })],
  });
}

// ══════════════════════════════════════════════════
//  BUILD DOCUMENT
// ══════════════════════════════════════════════════
async function main() {
  const pgSize = { width: 11906, height: 16838, orientation: "portrait" };
  const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

  // ── FOOTER ──
  function pageNumFooter(formatType) {
    const instrText = formatType === NumberFormat.UPPER_ROMAN
      ? "PAGE \\* ROMAN \\* MERGEFORMAT"
      : "PAGE \\* arabic \\* MERGEFORMAT";
    return new Footer({
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: { ascii: "Calibri" } }),
        ],
      })],
    });
  }

  // ── ANNUAL SUMMARY TABLE ──
  const annualData = [
    { period: "Ano 1 (Ramp-up)", rev: "RD$4,224,000", ct: "RD$7,741,770", nt: "-RD$3,517,770", cum: "-RD$3,517,770" },
    { period: "Ano 2 (Plena capacidad)", rev: "RD$12,672,000", ct: "RD$6,780,000", nt: "+RD$5,892,000", cum: "+RD$2,374,230" },
    { period: "Ano 3 (Madurez)", rev: "RD$4,224,000", ct: "RD$2,940,000", nt: "+RD$1,284,000", cum: "+RD$3,658,230" },
  ];

  const annualTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          tableHeaderCell("Periodo", 30),
          tableHeaderCell("Ingresos", 18),
          tableHeaderCell("Gastos", 18),
          tableHeaderCell("Resultado Neto", 18),
          tableHeaderCell("Balance Acum.", 16),
        ],
      }),
      ...annualData.map((r, i) => new TableRow({
        children: [
          tableDataCell(r.period, 30, i % 2 === 0, AlignmentType.LEFT),
          tableDataCell(r.rev, 18, i % 2 === 0, AlignmentType.RIGHT),
          tableDataCell(r.ct, 18, i % 2 === 0, AlignmentType.RIGHT),
          tableDataCell(r.nt, 18, i % 2 === 0, AlignmentType.RIGHT),
          tableDataCell(r.cum, 16, i % 2 === 0, AlignmentType.RIGHT),
        ],
      })),
      new TableRow({
        children: [
          tableTotalCell("Total 3 Anos", 30, true),
          tableTotalCell("RD$21,120,000", 18, true),
          tableTotalCell("RD$17,461,770", 18, true),
          tableTotalCell("+RD$3,658,230", 18, true),
          tableTotalCell("+RD$3,658,230", 16, true),
        ],
      }),
    ],
  });

  // ── EXPENSE BREAKDOWN TABLE ──
  const expenseData = [
    { cat: "Alimento (Nutriovo Sanut)", amt: "RD$11,664,188", pct: "66.8%", detail: "Cria + postura, 4 batches" },
    { cat: "Costos Operativos", amt: "RD$2,820,000", pct: "16.2%", detail: "Labor + servicios basicos" },
    { cat: "Infraestructura", amt: "RD$1,569,750", pct: "9.0%", detail: "4 galpones + almacen + bomba" },
    { cat: "Aves + Equipo + Vacunas", amt: "RD$1,407,832", pct: "8.1%", detail: "8,000 aves, equipos, 6 dosis" },
  ];

  const expenseTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          tableHeaderCell("Categoria", 30),
          tableHeaderCell("Monto Total", 20),
          tableHeaderCell("% del Total", 12),
          tableHeaderCell("Detalle", 38),
        ],
      }),
      ...expenseData.map((r, i) => new TableRow({
        children: [
          tableDataCell(r.cat, 30, i % 2 === 0, AlignmentType.LEFT),
          tableDataCell(r.amt, 20, i % 2 === 0, AlignmentType.RIGHT),
          tableDataCell(r.pct, 12, i % 2 === 0, AlignmentType.CENTER),
          tableDataCell(r.detail, 38, i % 2 === 0, AlignmentType.LEFT),
        ],
      })),
      new TableRow({
        children: [
          tableTotalCell("TOTAL", 30, true),
          tableTotalCell("RD$17,461,770", 20, true),
          tableTotalCell("100.0%", 12, true),
          tableTotalCell("Inversion completa a 3 anos", 38, true),
        ],
      }),
    ],
  });

  // ── KPI CARDS TABLE ──
  function kpiRow(metrics) {
    return new TableRow({
      children: metrics.map(m => new TableCell({
        width: { size: Math.floor(100 / metrics.length), type: WidthType.PERCENTAGE },
        borders: allNoBorders,
        shading: { type: ShadingType.CLEAR, fill: "FFFFFF" },
        margins: { top: 100, bottom: 100, left: 160, right: 160 },
        children: [
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: m.label, size: 18, color: c(P.secondary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, bold: true })],
          }),
          new Paragraph({
            spacing: { after: 30 },
            children: [new TextRun({ text: m.value, size: 30, color: c(m.color || P.accent), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, bold: true })],
          }),
          new Paragraph({
            children: [new TextRun({ text: m.sub, size: 18, color: c(P.secondary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
          }),
        ],
      })),
    });
  }

  const kpiTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allNoBorders,
    rows: [
      kpiRow([
        { label: "INVERSION TOTAL", value: "RD$5,041,822", sub: "Capital requerido", color: P.primary },
        { label: "PUNTO EQUILIBRIO", value: "Mes 19", sub: "Inicio del Ano 2", color: P.accent },
        { label: "ROI ESTIMADO", value: "72.6%", sub: "Sobre capital invertido", color: P.accent },
      ]),
      kpiRow([
        { label: "INGRESOS 3 ANOS", value: "RD$21.1M", sub: "3,840,000 huevos", color: P.accent },
        { label: "BENEFICIO NETO", value: "+RD$3.66M", sub: "Balance acumulado M35", color: P.accent },
        { label: "PRODUCCION PICO", value: "6,400/dia", sub: "8,000 aves x 80% postura", color: P.primary },
      ]),
    ],
  });

  // ── HIGHLIGHT BOX (info box) ──
  function infoBox(title, text) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: NB, bottom: NB, right: NB,
        left: { style: BorderStyle.SINGLE, size: 18, color: P.table.headerBg },
      },
      shading: { type: ShadingType.CLEAR, fill: P.table.surface },
      margins: { top: 120, bottom: 120, left: 200, right: 200 },
      rows: [new TableRow({
        children: [new TableCell({
          borders: { top: NB, bottom: NB, left: NB, right: NB },
          shading: { type: ShadingType.CLEAR, fill: P.table.surface },
          children: [
            new Paragraph({
              spacing: { after: 60 },
              children: [new TextRun({ text: title, bold: true, size: 22, color: c(P.accent), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
            }),
            new Paragraph({
              spacing: { line: 312 },
              children: [new TextRun({ text, size: 21, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
            }),
          ],
        })],
      })],
    });
  }

  // ══════════════════════════════════════════════════
  //  ASSEMBLE SECTIONS
  // ══════════════════════════════════════════════════

  // Section 1: Cover (no page number)
  const coverSection = {
    properties: {
      page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
    },
    children: [buildCover()],
  };

  // Section 2: TOC (Roman numerals)
  const tocSection = {
    properties: {
      type: SectionType.NEXT_PAGE,
      page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
    },
    footers: { default: pageNumFooter(NumberFormat.UPPER_ROMAN) },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 480, after: 360 },
        children: [new TextRun({ text: "CONTENIDO", bold: true, size: 32, font: { ascii: "Times New Roman", eastAsia: "SimHei" }, color: c(P.primary) })],
      }),
      new TableOfContents("Table of Contents", {
        hyperlink: true,
        headingStyleRange: "1-2",
      }),
      new Paragraph({
        spacing: { before: 200 },
        children: [new TextRun({
          text: "Nota: Para actualizar los numeros de pagina, haga clic derecho sobre el contenido y seleccione \"Actualizar campo\".",
          italics: true, size: 18, color: "888888",
        })],
      }),
      new Paragraph({ children: [new PageBreak()] }),
    ],
  };

  // Section 3: Body (Arabic from 1)
  const bodySection = {
    properties: {
      type: SectionType.NEXT_PAGE,
      page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
    },
    footers: { default: pageNumFooter(NumberFormat.DECIMAL) },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "Granja WD80  |  Resumen Ejecutivo", size: 18, color: "808080", font: { ascii: "Calibri" }, italics: true })],
        })],
      }),
    },
    children: [
      // ─────────────────────────────────────────────
      // 1. RESUMEN EJECUTIVO
      // ─────────────────────────────────────────────
      heading1("1. Resumen Ejecutivo"),

      bodyPara("El presente documento constituye un resumen ejecutivo de la proyeccion financiera a tres anos de la Granja de Gallinas WD80, ubicada en San Jose de los Llanos, Republica Dominicana. El proyecto contempla la operacion de cuatro galpones de 200 metros cuadrados cada uno, con una capacidad total de 8,000 aves distribuidas en cuatro batches escalonados de 2,000 pollitas WD80, con el objetivo de producir huevos comerciales para venta directa al consumidor y mercados locales a un precio de RD$5.50 por unidad."),

      bodyPara("El analisis financiero proyectado a 36 meses demuestra que la operacion requiere una inversion inicial total de RD$5,041,822, cifra que comprende la construccion de infraestructura, la adquisicion de aves, equipos, vacunas, y el suministro de alimento balanceado Nutriovo Sanut durante las fases de cria y postura. A pesar de una fase inicial de ramp-up con perdidas acumuladas durante el primer ano, el modelo financiero alcanza su punto de equilibrio en el mes 19, momento a partir del cual los ingresos superan consistentemente los gastos operativos."),

      bodyPara("Al cierre del tercer ano, la granja genera ingresos acumulados por RD$21,120,000 con un total de gastos de RD$17,461,770, arrojando un beneficio neto positivo de RD$3,658,230. Esto equivale a un retorno sobre inversion (ROI) estimado del 72.6% sobre el capital total invertido, una cifra considerablemente atractiva para un proyecto agropecuario de esta escala. La produccion pico alcanza aproximadamente 6,400 huevos diarios cuando las 8,000 gallinas se encuentran en plena postura simultaneamente."),

      // KPI Cards
      new Paragraph({ spacing: { before: 200, after: 100 }, children: [] }),
      kpiTable,
      new Paragraph({ spacing: { after: 100 }, children: [] }),

      // ─────────────────────────────────────────────
      // 2. DESCRIPCION DEL PROYECTO
      // ─────────────────────────────────────────────
      heading1("2. Descripcion del Proyecto"),

      heading2("2.1 Ubicacion e Infraestructura"),
      bodyPara("La granja se situa en San Jose de los Llanos, una zona con condiciones favorables para la avicultura en la Republica Dominicana. El terreno es propio, lo que elimina el costo de arrendamiento y proporciona estabilidad operativa a largo plazo. La infraestructura proyectada incluye la construccion de cuatro galpones de 200 metros cuadrados cada uno, un almacen central para alimento y suministros, y una bomba sumergible para el sistema de abastecimiento de agua. Los galpones 2, 3 y 4 se construyen escalonadamente durante los meses 2, 4 y 6 respectivamente, mientras que el primer galpon junto con el almacen y la bomba se levantan al inicio del proyecto."),

      heading2("2.2 Modelo de Produccion"),
      bodyPara("El sistema productivo se basa en la raza WD80, una linea genetica altamente productiva con una tasa de postura promedio del 80% a lo largo de un ciclo productivo de 20 meses, alcanzando picos de hasta 90% durante las semanas de maxima produccion. Las 8,000 aves se distribuyen en cuatro batches de 2,000 pollitas cada uno, con un inicio escalonado cada dos meses (meses 0, 2, 4 y 6). Este esquema permite un flujo de ingresos mas uniforme y reduce el impacto financiero de la inversion inicial."),

      bodyPara("Cada batch sigue un ciclo estandarizado que comprende cinco meses de cria (fases de pre-inicio, inicio, crecimiento y pre-postura) antes de iniciar la fase de produccion de huevos a partir de la semana 18-19 (aproximadamente el mes 5 del ciclo). La duracion estimada de la fase de postura es de 20 meses, durante los cuales cada batch genera ingresos mensuales de RD$264,000 provenientes de la venta de aproximadamente 48,000 huevos mensuales (2,000 aves x 80% postura x 30 dias)."),

      heading2("2.3 Alimentacion"),
      bodyPara("El programa alimenticio utiliza exclusivamente alimento balanceado de la marca Nutriovo Sanut, con un recargo estimado del 5% sobre los precios de referencia. Durante la fase de cria, el costo total de alimento por batch asciende a RD$516,047 distribuidos en cuatro etapas: pre-inicio (RD$37,530), inicio (RD$81,315), crecimiento (RD$320,370) y pre-postura (RD$76,832). Una vez en fase de produccion, cada batch consume aproximadamente 80 quintales mensuales de alimento de postura a un costo estimado de RD$1,500 por quintal, generando un gasto mensual de RD$120,000 por batch activo."),

      // ─────────────────────────────────────────────
      // 3. ESTRUCTURA DE INGRESOS
      // ─────────────────────────────────────────────
      heading1("3. Estructura de Ingresos"),

      bodyPara("Los ingresos del proyecto provienen exclusivamente de la venta de huevos frescos a un precio de RD$5.50 por unidad, canalizado a traves de ventas directas al consumidor y distribucion en mercados locales. La estructura de ingresos presenta un patron escalonado tipico de operaciones avicolas con arranque gradual, donde los ingresos mensuales crecen progresivamente a medida que cada batch alcanza la fase de postura."),

      bodyPara("El primer batch comienza a generar ingresos en el mes 5 con RD$264,000 mensuales. El segundo batch se incorpora al flujo productivo en el mes 7, elevando los ingresos a RD$528,000 mensuales. Para el mes 9, con tres batches produciendo, los ingresos mensuales alcanzan RD$792,000. A partir del mes 11, cuando los cuatro batches se encuentran en plena postura simultaneamente, la granja alcanza su maxima capacidad de generacion de ingresos con RD$1,056,000 mensuales, nivel que se mantiene constante hasta el mes 24 inclusive."),

      bodyPara("A partir del mes 25, los batches comienzan a completar su ciclo productivo de 20 meses, causando una reduccion gradual en los ingresos. Los meses 31 a 35 registran ingresos decrecientes hasta que la produccion cesa completamente al mes 35. Es importante senalar que en una operacion real, el reemplazo de pollitas deberia iniciarse entre los meses 20 y 22 para mantener la continuidad productiva, un aspecto que no esta modelado en la presente proyeccion."),

      // Chart: Revenue stacked
      chartPara("chart_revenue_stacked.png"),
      captionPara("Figura 1: Ingresos mensuales por batch a lo largo de 36 meses"),

      // ─────────────────────────────────────────────
      // 4. DESGLOSE DE GASTOS
      // ─────────────────────────────────────────────
      heading1("4. Desglose de Gastos"),

      bodyPara("El analisis de costos revela que el alimento representa el componente dominante de la estructura de gastos, constituyendo el 66.8% del total de egresos proyectados a tres anos. Este patron es consistente con la realidad de la industria avicola, donde el alimento balanceado absorbe entre el 60% y el 70% de los costos operativos. Los costos operativos (mano de obra y servicios basicos) representan el 16.2%, mientras que la infraestructura y la adquisicion de aves, equipos y vacunas absorben el 9.0% y el 8.1% respectivamente."),

      expenseTable,
      captionPara("Tabla 1: Desglose de gastos totales por categoria"),

      heading2("4.1 Alimentacion (RD$11,664,188)"),
      bodyPara("Con RD$11,664,188 a lo largo de 36 meses, el alimento es por amplio margen el mayor rubro de gasto. Durante la fase de cria, cada batch consume RD$516,047 en alimento a lo largo de cinco meses, abarcando cuatro etapas nutricionales especializadas con concentraciones proteicas decrecientes conforme las aves crecen. La fase mas costosa de cria es la de crecimiento (semanas 11-15), donde el consumo alcanza 177 quintales a RD$1,810 por quintal."),

      bodyPara("En la fase de postura, el gasto se estabiliza en RD$120,000 mensuales por batch (aproximadamente 80 quintales a RD$1,500 cada uno). Cuando los cuatro batches se encuentran en produccion simultanea (meses 11-24), el gasto mensual por alimento alcanza RD$480,000, cifra que representa el 85% del total de gastos mensuales durante ese periodo. Es fundamental confirmar estos precios con el proveedor Nutriovo, ya que cualquier variacion significativa en el costo del alimento tendria un impacto directo en la rentabilidad del proyecto."),

      heading2("4.2 Costos Operativos (RD$2,820,000)"),
      bodyPara("Los costos operativos, que incluyen mano de obra y servicios basicos (electricidad, agua, mantenimiento), se estructuran en tres niveles progresivos: RD$55,000 mensuales durante los meses 0-4 (fase de construccion e instalacion), RD$70,000 mensuales durante los meses 5-10 (escalamiento productivo), y RD$85,000 mensuales a partir del mes 11 (operacion a plena capacidad). Esta escalonamiento refleja la necesidad progresiva de mayor personal conforme la granja incrementa su carga de trabajo con la incorporacion de cada nuevo batch."),

      heading2("4.3 Infraestructura (RD$1,569,750)"),
      bodyPara("La inversion en infraestructura asciende a RD$1,569,750 y comprende la construccion del primer galpon junto con el almacen y la bomba sumergible (RD$624,750 en el mes 0), seguida de tres galpones adicionales de RD$315,000 cada uno en los meses 2, 4 y 6. Es importante destacar que el almacen y la bomba son activos compartidos que benefician a los cuatro galpones, optimizando asi la inversion inicial. El costo unitario de cada galpon de 200 metros cuadrados resulta competitivo dentro de los estandares de la region."),

      heading2("4.4 Aves, Equipo y Vacunas (RD$1,407,832)"),
      bodyPara("La adquisicion de aves, equipos y vacunas por batch suma RD$351,958, distribuido de la siguiente manera: RD$172,200 en pollitas WD80 (2,000 unidades a RD$86.10 cada una), RD$127,080 en equipo por galpon (bebederos, comederos, ponederos y aserrin), y RD$52,678 en el programa de vacunacion completo de seis dosis (administradas entre los dias 10 y 105 de vida). Con cuatro batches, el gasto total en esta categoria alcanza RD$1,407,832, representando una inversion considerable pero necesaria para garantizar la bioseguridad y el bienestar animal del plantel."),

      // Pie chart
      chartPara("chart_expense_pie.png"),
      captionPara("Figura 2: Distribucion porcentual de los gastos totales"),

      // ─────────────────────────────────────────────
      // 5. FLUJO DE CAJA Y PUNTO DE EQUILIBRIO
      // ─────────────────────────────────────────────
      heading1("5. Flujo de Caja y Punto de Equilibrio"),

      bodyPara("El analisis del flujo de caja mensual revela un patron financiero clasico de proyectos agropecuarios con alta inversion inicial y retorno gradual. Los primeros cuatro meses se caracterizan por fuertes salidas de efectivo destinadas a la construccion de infraestructura y la adquisicion de aves y suministros, sin generacion de ingresos. El mes 0 registra la mayor salida de caja con RD$1,069,238, seguido de los meses 2, 4 y 6 con desembolsos cercanos al millon de pesos por la incorporacion de cada nuevo batch."),

      bodyPara("A partir del mes 5, cuando el primer batch inicia la postura, los ingresos comienzan a compensar parcialmente los gastos, aunque el flujo mensual permanece negativo hasta el mes 10, cuando tres batches produciendo permiten el primer mes con flujo neto positivo (+RD$285,168). A partir de ese momento, el flujo mensual se mantiene positivo de manera consistente, alcanzando su maximo de RD$491,000 mensuales netos durante el periodo de plena capacidad (meses 11-24), cuando los cuatro batches producen simultaneamente."),

      bodyPara("El punto de equilibrio acumulado se alcanza en el mes 19, momento en el cual el balance acumulado pasa de negativo a positivo. Esto significa que despues de 19 meses de operacion, la granja ha recuperado la totalidad de la inversion inicial y comienza a generar ganancias netas. El flujo de caja acumulado al cierre del mes 35 asciende a RD$3,658,230, representando el beneficio neto total del periodo proyectado."),

      // Cash flow line chart
      chartPara("chart_cashflow_line.png"),
      captionPara("Figura 3: Evolucion del flujo de caja acumulado durante 36 meses"),

      // Annual summary
      heading2("5.1 Resumen Financiero Anual"),
      bodyPara("El primer ano refleja la fase de mayor demanda de capital, con ingresos de RD$4,224,000 frente a gastos de RD$7,741,770, generando una perdida neta de RD$3,517,770. Este resultado es esperado dado que el ano 1 incluye toda la inversion en infraestructura, la adquisicion de aves y la alimentacion de cria para los cuatro batches, mientras que solo los ultimos meses del ano registran ingresos completos de produccion."),

      bodyPara("El segundo ano marca un punto de inflexion significativo. Con los cuatro batches en plena produccion durante los primeros 14 meses del periodo, los ingresos ascienden a RD$12,672,000 mientras los gastos se reducen a RD$6,780,000 al eliminarse los costos de infraestructura y cria. El resultado neto del ano 2 es de +RD$5,892,000, compensando ampliamente la perdida del primer ano y dejando un balance acumulado positivo de RD$2,374,230."),

      bodyPara("El tercer ano muestra ingresos de RD$4,224,000 con gastos de RD$2,940,000, generando un beneficio neto de RD$1,284,000. La reduccion de ingresos se debe a la finalizacion del ciclo productivo de los batches, aunque los gastos tambien disminuyen proporcionalmente al cesar la compra de alimento de postura y reducirse los costos operativos. El balance acumulado finaliza en RD$3,658,230."),

      annualTable,
      captionPara("Tabla 2: Resumen financiero anual"),

      // Annual bar chart
      chartPara("chart_annual_bar.png"),
      captionPara("Figura 4: Comparativa anual de ingresos vs. gastos"),

      // ─────────────────────────────────────────────
      // 6. ANALISIS DE RENTABILIDAD
      // ─────────────────────────────────────────────
      heading1("6. Analisis de Rentabilidad"),

      bodyPara("La evaluacion de la rentabilidad del proyecto arroja indicadores favorables que posicionan a la Granja WD80 como una inversion agropecuaria atractiva. El Retorno sobre Inversion (ROI) estimado del 72.6% a tres anos supera ampliamente las tasas de retorno tipicas de instrumentos financieros conservadores en Republica Dominicana y se compara favorablemente con otros proyectos agropecuarios de similar escala en la region."),

      bodyPara("La estructura financiera del proyecto presenta un periodo de recuperacion (payback) de 19 meses, lo cual resulta competitivo para un emprendimiento de esta naturaleza. Es relevante destacar que este plazo se extiende a traves de la fase de ramp-up, donde los gastos de infraestructura y cria generan una demanda significativa de capital que se va recuperando progresivamente a medida que los batches entran en produccion. Una vez alcanzado el punto de equilibrio, la generacion de caja es robusta y sostenida."),

      bodyPara("La unidad economica fundamental del negocio es altamente rentable: cada huevo producido se vende a RD$5.50, mientras que el costo de produccion estimado por huevo (incluyendo alimento, mano de obra y costos operativos prorrateados) se situa por debajo de RD$4.00 durante el periodo de plena produccion, generando un margen bruto superior al 25% por unidad. A escala de operacion completa, con 8,000 gallinas produciendo al 80% de capacidad, la granja genera aproximadamente 192,000 huevos mensuales (6,400 diarios) con ingresos de RD$1,056,000."),

      // ─────────────────────────────────────────────
      // 7. RIESGOS Y RECOMENDACIONES
      // ─────────────────────────────────────────────
      heading1("7. Riesgos y Recomendaciones"),

      heading2("7.1 Riesgos Identificados"),

      bodyParaBold("Volatilidad del precio del alimento: ", "El alimento representa el 66.8% de los costos totales. Un incremento del 10% en el precio de Nutriovo Sanut elevaria los gastos totales en aproximadamente RD$1.17 millones a tres anos, reduciendo el beneficio neto proyectado. Se recomienda establecer contratos de suministro a precio fijo o explorar opciones de produccion parcial de alimento en la granja."),

      bodyParaBold("Fluctuacion del precio del huevo: ", "El modelo asume un precio constante de RD$5.50 por huevo. Variaciones estacionales o presion competitiva podrian afectar este precio. Se recomienda diversificar los canales de venta (hoteles, restaurantes, supermercados) para reducir la dependencia de un unico canal y mejorar el poder de negociacion."),

      bodyParaBold("Enfermedades avicolas: ", "Un brote de enfermedad podria causar mortalidad significativa y perdida de produccion. El programa de vacunacion contemplado (6 dosis) mitiga parcialmente este riesgo, pero se recomienda implementar protocolos estrictos de bioseguridad, cuarentena para aves nuevas, y mantener un fondo de contingencia para emergencias sanitarias."),

      bodyParaBold("Financiamiento del ciclo 2: ", "El modelo no contempla la reposicion de las 8,000 aves al finalizar su ciclo productivo de 20 meses. Iniciar la compra de pollitas de reemplazo entre los meses 20-22 implicaria una inversion adicional estimada de RD$1.4 millones, ademas de los costos de cria asociados. Planificar esta reinversion es critico para la sostenibilidad del negocio."),

      heading2("7.2 Recomendaciones Estrategicas"),

      infoBox("Recomendacion Principal",
        "Se recomienda constituir un colchon de liquidez de entre RD$200,000 y RD$300,000 adicionales para cubrir imprevistos operativos, variaciones en precios de alimento, y contingencias sanitarias. Este fondo no esta incluido en la proyeccion actual pero resulta esencial para la resiliencia financiera del proyecto durante sus primeros anos de operacion."),

      new Paragraph({ spacing: { before: 200 }, children: [] }),

      bodyPara("Adicionalmente, se recomienda desarrollar acuerdos comerciales formales con al menos tres canales de distribucion diferentes para garantizar la colocacion de la produccion completa. La venta directa al consumidor, aunque ofrece mejores margenes, debe complementarse con contratos con establecimientos comerciales que aseguren un flujo de ingresos predecible."),

      bodyPara("Finalmente, la planificacion del segundo ciclo productivo debe iniciarse no mas tarde del mes 18, anticipando la compra de pollitas de reemplazo para el primer batch. Esta planificacion anticipada permitira mantener la continuidad de la produccion y evitar periodos de subutilizacion de la infraestructura, maximizando asi el retorno sobre la inversion en galpones y equipos."),
    ],
  };

  // ── CREATE DOC ──
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
            size: 24,
            color: c(P.body),
          },
          paragraph: {
            spacing: { line: 312 },
          },
        },
        heading1: {
          run: {
            font: { ascii: "Times New Roman", eastAsia: "SimHei" },
            size: 32,
            bold: true,
            color: c(P.primary),
          },
        },
        heading2: {
          run: {
            font: { ascii: "Times New Roman", eastAsia: "SimHei" },
            size: 28,
            bold: true,
            color: c(P.primary),
          },
        },
      },
    },
    sections: [coverSection, tocSection, bodySection],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(DOCX_OUT, buffer);
  console.log("Document generated:", DOCX_OUT);
}

main().catch(err => { console.error("Error:", err); process.exit(1); });
