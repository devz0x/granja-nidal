const { Document, Packer, Paragraph, TextRun, ImageRun, Header, Footer,
        AlignmentType, HeadingLevel, PageNumber, PageBreak, TableOfContents,
        Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
        SectionType, NumberFormat } = require("docx");
const fs = require("fs");
const path = require("path");
const { imageSize } = require("image-size");

const OUT = "/home/z/my-project/download";
const DOCX_OUT = path.join(OUT, "Proyeccion_5_Anos_Granja_WD80.docx");

// ── PALETTE ──
const P = { primary:"1C2C28", body:"1C2C28", secondary:"5A7068", accent:"2A7A65", surface:"EDF5F2",
  table:{ headerBg:"2A7A65", headerText:"FFFFFF", accentLine:"2A7A65", innerLine:"C5D8D0", surface:"EDF5F2" }};
const c = h => h.replace("#","");

// ── BORDERS ──
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const allNoBorders = { top:NB, bottom:NB, left:NB, right:NB, insideHorizontal:NB, insideVertical:NB };

// ── DATA ──
const D = JSON.parse(fs.readFileSync(path.join(OUT,"strategy_data.json"),"utf8"));
const S = { A: D.A, B: D.B, C: D.C };
const comp = D.comparison;

// ── IMAGE HELPER ──
function embedImg(fn) {
  const buf = fs.readFileSync(path.join(OUT,fn));
  const dm = imageSize(buf);
  let w = 480, h = Math.round(w*(dm.height/dm.width));
  if (h > 270) { h = 270; w = Math.round(h*(dm.width/dm.height)); }
  return { data:buf, transformation:{width:w,height:h}, type:"png" };
}
function chartP(fn) {
  return new Paragraph({ alignment:AlignmentType.CENTER, spacing:{before:200,after:80},
    children:[new ImageRun(embedImg(fn))] });
}
function capP(t) {
  return new Paragraph({ alignment:AlignmentType.CENTER, spacing:{before:40,after:160},
    children:[new TextRun({text:t, italics:true, size:21, color:c(P.secondary), font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"}})] });
}

// ── FORMATTERS ──
function fmt(n) { const a=Math.round(Math.abs(n)); return (n<0?"-RD$":"RD$")+a.toLocaleString("en"); }

function h1(t) {
  return new Paragraph({ heading:HeadingLevel.HEADING_1, spacing:{before:360,after:200},
    children:[new TextRun({text:t, bold:true, font:{ascii:"Times New Roman",eastAsia:"SimHei"}, size:32, color:c(P.primary)})] });
}
function h2(t) {
  return new Paragraph({ heading:HeadingLevel.HEADING_2, spacing:{before:280,after:160},
    children:[new TextRun({text:t, bold:true, font:{ascii:"Times New Roman",eastAsia:"SimHei"}, size:28, color:c(P.primary)})] });
}
function bp(t) {
  return new Paragraph({ alignment:AlignmentType.JUSTIFIED, indent:{firstLine:480}, spacing:{line:312,after:80},
    children:[new TextRun({text:t, size:24, font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"}, color:c(P.body)})] });
}
function bpB(b,t) {
  return new Paragraph({ alignment:AlignmentType.JUSTIFIED, indent:{firstLine:480}, spacing:{line:312,after:80},
    children:[
      new TextRun({text:b, bold:true, size:24, font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"}, color:c(P.body)}),
      new TextRun({text:t, size:24, font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"}, color:c(P.body)})
    ] });
}

// ── TABLE HELPERS ──
function thCell(t,w,al=AlignmentType.CENTER) {
  return new TableCell({ width:{size:w,type:WidthType.PERCENTAGE},
    shading:{type:ShadingType.CLEAR,fill:P.table.headerBg},
    borders:{top:NB,left:NB,right:NB,bottom:{style:BorderStyle.SINGLE,size:2,color:P.table.headerBg}},
    margins:{top:80,bottom:80,left:100,right:100},
    children:[new Paragraph({alignment:al,
      children:[new TextRun({text:t, bold:true, size:20, color:P.table.headerText, font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"}})]})] });
}
function tdCell(t,w,alt=false,al=AlignmentType.CENTER,bold=false,color) {
  const clr = color || c(P.body);
  return new TableCell({ width:{size:w,type:WidthType.PERCENTAGE},
    shading: alt ? {type:ShadingType.CLEAR,fill:P.table.surface} : {type:ShadingType.CLEAR,fill:"FFFFFF"},
    borders:{top:{style:BorderStyle.SINGLE,size:1,color:P.table.innerLine},bottom:{style:BorderStyle.SINGLE,size:1,color:P.table.innerLine},left:NB,right:NB},
    margins:{top:60,bottom:60,left:100,right:100},
    children:[new Paragraph({alignment:al,
      children:[new TextRun({text:t, size:20, color:clr, font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"}, bold})]})] });
}
function totCell(t,w,bold=true) {
  return new TableCell({ width:{size:w,type:WidthType.PERCENTAGE},
    shading:{type:ShadingType.CLEAR,fill:P.table.surface},
    borders:{top:{style:BorderStyle.SINGLE,size:2,color:P.table.accentLine},bottom:{style:BorderStyle.SINGLE,size:2,color:P.table.accentLine},left:NB,right:NB},
    margins:{top:80,bottom:80,left:100,right:100},
    children:[new Paragraph({alignment:AlignmentType.CENTER,
      children:[new TextRun({text:t, bold:true, size:20, color:c(P.primary), font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"}})]})] });
}

// ── INFO BOX ──
function infoBox(title, text) {
  return new Table({ width:{size:100,type:WidthType.PERCENTAGE},
    borders:{top:NB,bottom:NB,right:NB,left:{style:BorderStyle.SINGLE,size:18,color:P.table.headerBg}},
    shading:{type:ShadingType.CLEAR,fill:P.table.surface},
    margins:{top:120,bottom:120,left:200,right:200},
    rows:[new TableRow({children:[new TableCell({
      borders:{top:NB,bottom:NB,left:NB,right:NB}, shading:{type:ShadingType.CLEAR,fill:P.table.surface},
      children:[
        new Paragraph({spacing:{after:60}, children:[new TextRun({text:title, bold:true, size:22, color:c(P.accent), font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"}})]}),
        new Paragraph({spacing:{line:312}, children:[new TextRun({text, size:21, color:c(P.body), font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"}})]}),
      ]})] })] });
}

// ── KPI TABLE ──
function kpiRow(metrics) {
  return new TableRow({ children: metrics.map(m => new TableCell({
    width:{size:Math.floor(100/metrics.length),type:WidthType.PERCENTAGE},
    borders:allNoBorders, shading:{type:ShadingType.CLEAR,fill:"FFFFFF"},
    margins:{top:100,bottom:100,left:140,right:140},
    children:[
      new Paragraph({spacing:{after:40}, children:[new TextRun({text:m.label, size:17, color:c(P.secondary), font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"}, bold:true})]}),
      new Paragraph({spacing:{after:30}, children:[new TextRun({text:m.value, size:28, color:c(m.color||P.accent), font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"}, bold:true})]}),
      new Paragraph({children:[new TextRun({text:m.sub, size:17, color:c(P.secondary), font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"}})]}),
    ] })) });
}

// ── COVER ──
function buildCover() {
  const title = "Proyeccion Financiera a 5 Anos con Reemplazo de Ciclo";
  const subtitle = "Analisis Comparativo de Estrategias para Granja WD80";
  const availW = 11906 - 240;
  let pt = 34, lines;
  const cpl = Math.floor(availW / (pt * 20));
  if (title.length <= cpl) { lines = [title]; }
  else {
    // split at spaces
    const words = title.split(" "); lines = []; let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length > cpl) { lines.push(cur.trim()); cur = w; }
      else { cur = cur ? cur + " " + w : w; }
    }
    if (cur) lines.push(cur);
    if (lines.length > 3) lines = lines.slice(0,3);
  }
  const topSp = 4500;
  const ls = Math.ceil(pt * 23);
  return new Table({ borders:allNoBorders, width:{size:100,type:WidthType.PERCENTAGE},
    rows:[new TableRow({ height:{value:16838,rule:"exact"}, verticalAlign:"top",
      children:[new TableCell({ borders:allNoBorders, shading:{type:ShadingType.CLEAR,fill:"0C1F1A"},
        margins:{top:0,bottom:0,left:1200,right:1200}, width:{size:100,type:WidthType.PERCENTAGE},
        children:[
          new Paragraph({spacing:{before:topSp}, children:[]}),
          ...lines.map((l,i) => new Paragraph({spacing:{after:i===lines.length-1?100:30, line:ls, lineRule:"atLeast"},
            children:[new TextRun({text:l, bold:true, font:{ascii:"Times New Roman",eastAsia:"SimHei"}, size:pt*2, color:"FFFFFF"})]})),
          new Paragraph({spacing:{before:200,after:250,line:400,lineRule:"atLeast"},
            children:[new TextRun({text:subtitle, font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"}, size:26, color:"B0B8C0", italics:true})]}),
          new Paragraph({indent:{left:1000,right:1000}, border:{top:{style:BorderStyle.SINGLE,size:12,color:P.table.headerBg,space:20}}, children:[]}),
          new Paragraph({spacing:{before:250,after:60}, children:[new TextRun({text:"Granja de Gallinas WD80  |  8,000 aves en 4 galpones", size:22, color:"B0B8C0", font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"}})]}),
          new Paragraph({spacing:{after:60}, children:[new TextRun({text:"San Jose de los Llanos, Republica Dominicana", size:20, color:"90989F", font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"}})]}),
          new Paragraph({children:[new TextRun({text:"Abril 2026", size:20, color:"90989F", font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"}})]}),
        ] })] })] });
}

// ══════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════
async function main() {
  const pgS = {width:11906,height:16838};
  const pgM = {top:1440,bottom:1440,left:1701,right:1417};

  function pnf() {
    return new Footer({ children:[new Paragraph({alignment:AlignmentType.CENTER,
      children:[new TextRun({children:[PageNumber.CURRENT], size:18, color:"808080", font:{ascii:"Calibri"}})]})] });
  }

  // ── COMPARISON TABLE ──
  const compRows = [
    ["Inversion total", fmt(S.A.summary.totalInv), fmt(S.B.summary.totalInv), fmt(S.C.summary.totalInv)],
    ["Reemplazos realizados", S.A.summary.replCount+"", S.B.summary.replCount+"", S.C.summary.replCount+""],
    ["Ingresos totales", fmt(S.A.summary.totalRev), fmt(S.B.summary.totalRev), fmt(S.C.summary.totalRev)],
    ["  Venta de huevos", fmt(S.A.summary.totalEgg), fmt(S.B.summary.totalEgg), fmt(S.C.summary.totalEgg)],
    ["  Venta de gallinas", fmt(S.A.summary.totalHens), fmt(S.B.summary.totalHens), fmt(S.C.summary.totalHens)],
    ["Gastos totales", fmt(S.A.summary.totalCost), fmt(S.B.summary.totalCost), fmt(S.C.summary.totalCost)],
    ["Beneficio neto (M60)", fmt(S.A.summary.finalCum), fmt(S.B.summary.finalCum), fmt(S.C.summary.finalCum)],
    ["ROI", S.A.summary.roi+"%", S.B.summary.roi+"%", S.C.summary.roi+"%"],
    ["Punto equilibrio", S.A.summary.be>=0?"Mes "+S.A.summary.be:"--", S.B.summary.be>=0?"Mes "+S.B.summary.be:"--", S.C.summary.be>=0?"Mes "+S.C.summary.be:"--"],
  ];

  const compTable = new Table({ width:{size:100,type:WidthType.PERCENTAGE},
    rows:[
      new TableRow({ tableHeader:true, children:[
        thCell("Indicador",32,AlignmentType.LEFT), thCell("A: Ciclo 20m",22),
        thCell("B: Ciclo 22m",22), thCell("C: Cria anticipada",24)] }),
      ...compRows.map((r,i) => new TableRow({ children:[
        tdCell(r[0],32,i%2===0,AlignmentType.LEFT,true),
        tdCell(r[1],22,i%2===0),
        tdCell(r[2],22,i%2===0),
        tdCell(r[3],24,i%2===0,undefined,S.C.summary.roi && i===7 && parseFloat(r[3])>parseFloat(r[1]) && parseFloat(r[3])>parseFloat(r[2]) ? c(P.accent) : undefined),
      ] })),
    ] });

  // ── ANNUAL TABLE (Strategy C) ──
  const cy = comp.C_years;
  const annTable = new Table({ width:{size:100,type:WidthType.PERCENTAGE},
    rows:[
      new TableRow({ tableHeader:true, children:[
        thCell("Periodo",20,AlignmentType.LEFT), thCell("Huevos",18), thCell("Venta gallinas",16),
        thCell("Gastos",18), thCell("Neto",14), thCell("Acumulado",14)] }),
      ...cy.map((y,i) => {
        const netClr = y.net >= 0 ? c(P.accent) : c("#A32D2D");
        return new TableRow({ children:[
          tdCell("Ano "+(i+1),20,i%2===0,AlignmentType.LEFT,true),
          tdCell(fmt(y.eggRev),18,i%2===0,AlignmentType.RIGHT),
          tdCell(fmt(y.henRev),16,i%2===0,AlignmentType.RIGHT),
          tdCell(fmt(y.cost),18,i%2===0,AlignmentType.RIGHT),
          tdCell(fmt(y.net),14,i%2===0,AlignmentType.RIGHT,false,netClr),
          tdCell(fmt(y.ce),14,i%2===0,AlignmentType.RIGHT,true),
        ] });
      }),
    ] });

  // ── COST COMPARISON TABLE ──
  const costData = [
    ["Alimento (Nutriovo Sanut)", "66.8%","57.1%","58.4%"],
    ["Costos operativos (labor+servicios)", "16.2%","18.0%","12.2%"],
    ["Aves, vacunas y reemplazo", "8.1%","16.1%","17.7%"],
    ["Infraestructura (unica vez)", "9.0%","8.8%","7.5%"],
  ];
  const costTable = new Table({ width:{size:100,type:WidthType.PERCENTAGE},
    rows:[
      new TableRow({ tableHeader:true, children:[
        thCell("Categoria",36,AlignmentType.LEFT), thCell("Estrat. A",21), thCell("Estrat. B",21), thCell("Estrat. C",22)] }),
      ...costData.map((r,i) => new TableRow({ children:[
        tdCell(r[0],36,i%2===0,AlignmentType.LEFT),
        tdCell(r[1],21,i%2===0), tdCell(r[2],21,i%2===0), tdCell(r[3],22,i%2===0),
      ] })),
    ] });

  // ── BUILD DOCUMENT ──
  const doc = new Document({
    styles:{ default:{ document:{ run:{font:{ascii:"Calibri",eastAsia:"Microsoft YaHei"},size:24,color:c(P.body)},
      paragraph:{spacing:{line:312}} }, heading1:{run:{font:{ascii:"Times New Roman",eastAsia:"SimHei"},size:32,bold:true,color:c(P.primary)}},
      heading2:{run:{font:{ascii:"Times New Roman",eastAsia:"SimHei"},size:28,bold:true,color:c(P.primary)}} }},
    sections:[
      // COVER
      { properties:{ page:{size:pgS,margin:{top:0,bottom:0,left:0,right:0}} },
        children:[buildCover()] },
      // TOC
      { properties:{ type:SectionType.NEXT_PAGE, page:{size:pgS,margin:pgM,pageNumbers:{start:1,formatType:NumberFormat.UPPER_ROMAN}} },
        footers:{default:pnf()},
        children:[
          new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:480,after:360},
            children:[new TextRun({text:"CONTENIDO",bold:true,size:32,font:{ascii:"Times New Roman",eastAsia:"SimHei"},color:c(P.primary)})]}),
          new TableOfContents("TOC",{hyperlink:true,headingStyleRange:"1-2"}),
          new Paragraph({spacing:{before:200},children:[new TextRun({text:"Nota: Para actualizar numeros de pagina, haga clic derecho sobre el contenido y seleccione \"Actualizar campo\".",italics:true,size:18,color:"888888"})]}),
          new Paragraph({children:[new PageBreak()]}),
        ] },
      // BODY
      { properties:{ type:SectionType.NEXT_PAGE, page:{size:pgS,margin:pgM,pageNumbers:{start:1,formatType:NumberFormat.DECIMAL}} },
        footers:{default:pnf()},
        headers:{default:new Header({children:[new Paragraph({alignment:AlignmentType.RIGHT,
          children:[new TextRun({text:"Granja WD80  |  Proyeccion 5 Anos",size:18,color:"808080",font:{ascii:"Calibri"},italics:true})]})]})},
        children:[

          // ═══ 1. RESUMEN EJECUTIVO ═══
          h1("1. Resumen Ejecutivo"),

          bp("El presente documento extiende la proyeccion financiera original de la Granja de Gallinas WD80 de 3 a 5 anos (60 meses), incorporando un elemento critico que el modelo inicial no contemplaba: el reemplazo ciclico de las gallinas al final de su vida productiva. Las gallinas WD80 tienen un ciclo de postura de 20 a 22 meses, tras el cual son vendidas como gallinas de desecho a RD$100 por unidad y reemplazadas con pollitas nuevas para reiniciar el ciclo productivo."),

          bp("Se evaluaron tres estrategias de reemplazo para determinar cual maximiza la rentabilidad del proyecto: (A) ciclo base de 20 meses con reemplazo inmediato al finalizar la postura, (B) ciclo extendido de 22 meses que aprovecha dos meses adicionales de produccion decreciente, y (C) ciclo de 20 meses con cria anticipada, donde las pollitas de reemplazo se adquieren 5 meses antes de vender las gallinas viejas, permitiendo una transicion sin interrupcion en la produccion de huevos."),

          bp("Los resultados son contundentes: la Estrategia C (cria anticipada) genera un beneficio neto acumulado de RD$15,601,854 a 5 anos, con un ROI del 224% sobre la inversion total. Esto representa un incremento del 55% sobre la Estrategia A (RD$10,062,686, ROI 145%) y del 37% sobre la Estrategia B (RD$11,383,840, ROI 169%). La ventaja fundamental de la Estrategia C radica en la eliminacion de los periodos de 5 meses sin produccion que ocurren en las estrategias A y B cada vez que un batch es reemplazado, permitiendo mantener los 4 galpones produciendo huevos de forma continua durante todo el periodo de 5 anos."),

          // KPIs
          new Paragraph({spacing:{before:200,after:80},children:[]}),
          new Table({ borders:allNoBorders, width:{size:100,type:WidthType.PERCENTAGE},
            rows:[
              kpiRow([
                {label:"BENEFICIO NETO 5 ANOS",value:"RD$15.6M",sub:"Estrategia C recomendada",color:P.accent},
                {label:"ROI SOBRE INVERSION",value:"224%",sub:"Incluyendo reemplazos",color:P.accent},
                {label:"HUEVOS VENDIDOS",value:"9.98M",sub:"+23% vs estrategia base",color:P.primary},
              ]),
              kpiRow([
                {label:"REEMPLAZOS REALIZADOS",value:"8 ciclos",sub:"4 galpones x 2 ciclos completos",color:P.secondary},
                {label:"VENTA GALLINAS",value:"RD$1.6M",sub:"Ingreso adicional por desecho",color:P.secondary},
                {label:"PUNTO EQUILIBRIO",value:"Mes 19",sub:"Igual en las 3 estrategias",color:P.secondary},
              ]),
            ] }),
          new Paragraph({spacing:{after:100},children:[]}),

          // ═══ 2. MARCO CONCEPTUAL ═══
          h1("2. Marco Conceptual del Reemplazo Ciclico"),

          h2("2.1 Ciclo Productivo de la Gallina WD80"),
          bp("La raza WD80 es una linea genetica de alto rendimiento desarrollada especificamente para la produccion de huevos comerciales. Su ciclo productivo se divide en dos fases claramente diferenciadas. La fase de cria dura aproximadamente 5 meses (18-20 semanas) e incluye las etapas de pre-inicio, inicio, crecimiento y pre-postura, durante las cuales las pollitas reciben alimentacion especializada con concentraciones proteicas decrecientes y el programa completo de vacunacion. Al final de esta fase, las aves alcanzan la madurez sexual y comienzan la fase de postura."),

          bp("La fase de postura tiene una duracion productiva tipica de 20 a 22 meses, durante los cuales la tasa de postura se mantiene en promedio del 80% en los primeros 18 meses. A partir del mes 19, la produccion comienza a declinar gradualmente: mes 19 (78%), mes 20 (74%), mes 21 (68%) y mes 22 (62%). Al finalizar el ciclo, las gallinas son vendidas como gallinas de desecho para consumo humano a un precio de mercado de aproximadamente RD$100 por unidad, generando un ingreso de RD$200,000 por batch de 2,000 aves."),

          h2("2.2 Costos de Reemplazo vs. Inversion Inicial"),
          bp("El costo de reemplazo de un batch difiere significativamente de la inversion inicial porque el equipo del galpon (bebederos, comederos, ponederos) es reutilizable. La inversion inicial por batch asciende a RD$351,958 (aves RD$172,200 + equipo RD$127,080 + vacunas RD$52,678), mientras que el costo de reemplazo se estima en RD$240,000 (aves RD$172,200 + nuevo aserrin y mantenimiento RD$15,000 + vacunas RD$52,678). La diferencia de RD$111,958 por batch representa el valor residual del equipo reutilizado, lo que reduce considerablemente el costo de los ciclos subsecuentes."),

          h2("2.3 El Problema del Periodo de Transicion"),
          bp("En las estrategias tradicionales de reemplazo (Estrategia A y B), cuando un batch completa su ciclo de postura y las gallinas son vendidas, se adquieren nuevas pollitas que requieren 5 meses de cria antes de comenzar a producir huevos. Durante estos 5 meses, el galpon correspondiente no genera ingresos de huevos, creando un \"hueco productivo\" que impacta negativamente el flujo de caja. Con 4 galpones y reemplazos escalonados, estos huecos se presentan periodicamente, reduciendo la capacidad productiva global de la granja."),

          bp("La Estrategia C resuelve este problema mediante la cria anticipada: las pollitas de reemplazo se adquieren 5 meses antes de la venta de las gallinas viejas, de modo que cuando estas se venden, las nuevas pollitas ya tienen 5 meses de edad y estan listas para comenzar la postura inmediatamente. Esto requiere un area de cria/brooding separada (una instalacion menor que muchas granjas ya poseen), pero elimina completamente los periodos sin produccion."),

          // ═══ 3. ESTRATEGIAS EVALUADAS ═══
          h1("3. Estrategias Evaluadas"),

          h2("3.1 Estrategia A: Ciclo 20 meses (Reemplazo Inmediato)"),
          bp("Esta estrategia mantiene el ciclo de postura original de 20 meses. Al finalizar la postura, las gallinas se venden inmediatamente a RD$100 por unidad y se compran nuevas pollitas que inician su fase de cria de 5 meses. Durante la proyeccion de 60 meses, cada galpon completa 2 ciclos completos de 25 meses cada uno (5 meses cria + 20 meses postura), con 10 meses de inactividad productiva acumulados por galpon. El beneficio neto acumulado es de RD$10,062,686 con un ROI del 145%."),

          bp("El principal inconveniente de esta estrategia es la perdida de 5 meses de produccion por cada reemplazo. Con 4 galpones y 2 ciclos cada uno, se acumulan 40 meses-galpon de inactividad productiva en los 5 anos, equivalente a que uno de los 4 galpones estuviera completamente parado durante 10 meses. En terminos de huevos, se dejan de producir aproximadamente 1,872,000 unidades (RD$10,296,000 en ingresos perdidos) debido a estos periodos de transicion."),

          h2("3.2 Estrategia B: Ciclo 22 meses (Produccion Extendida)"),
          bp("Esta estrategia extiende el ciclo de postura a 22 meses para aprovechar dos meses adicionales de produccion, aunque a tasas decrecientes (68% y 62% en los meses 21 y 22 respectivamente). Al proyectar a 5 anos, cada galpon completa 2 ciclos de 27 meses (5 cria + 22 postura), con 6 meses de inactividad. Se requieren 7 reemplazos en total (vs. 8 en la Estrategia A) porque los ciclos mas largos reducen la cantidad de ciclos completos dentro del periodo de 5 anos."),

          bp("El beneficio neto es de RD$11,383,840 con un ROI del 169%, superior a la Estrategia A en un 13%. Sin embargo, los dos meses adicionales de produccion a tasas decrecientes generan ingresos marginales de aproximadamente RD$405,600 por batch (sumando meses 21 y 22), mientras que los costos de alimento durante esos meses ascienden a RD$228,000. El beneficio marginal neto por batch es de solo RD$177,600 por los dos meses extra, lo que no compensa completamente la perdida productiva del periodo de transicion."),

          h2("3.3 Estrategia C: Ciclo 20 meses con Cria Anticipada (RECOMENDADA)"),
          bp("Esta es la estrategia optima identificada en el analisis. Compra las pollitas de reemplazo 5 meses antes de vender las gallinas viejas, criandolas en un area separada de brooding mientras las gallinas actuales continuan produciendo. Al momento de la venta, las nuevas pollitas tienen exactamente 5 meses y estan listas para ser trasladadas al galpon de postura, eliminando el periodo de inactividad productiva."),

          bp("Con esta estrategia, los 4 galpones mantienen produccion continua de huevos durante los 60 meses del periodo proyectado. Solo en los meses 24-25, 44-45 y 49-50 se presentan ligeras reducciones temporales de 3 batches a 4 debido a la transicion, pero la produccion nunca cae a cero en ningun galpon. El resultado es un beneficio neto de RD$15,601,854, un ROI del 224%, y la venta de 9,984,000 huevos, un 23% mas que la Estrategia A y un 20% mas que la Estrategia B."),

          infoBox("Recomendacion Principal",
            "La Estrategia C es superior en todos los indicadores financieros clave. Genera RD$5.5 millones mas de beneficio neto que la Estrategia A y RD$4.2 millones mas que la Estrategia B a lo largo de 5 anos. Su unico requisito adicional es un area de cria/brooding separada, una inversion menor que se amortiza rapidamente con el aumento en produccion."),
          new Paragraph({spacing:{before:200},children:[]}),

          // ═══ 4. ANALISIS COMPARATIVO ═══
          h1("4. Analisis Comparativo"),

          chartP("chart_kpi_comparison.png"),
          capP("Figura 1: Comparacion de indicadores clave entre las tres estrategias"),

          compTable,
          capP("Tabla 1: Resumen comparativo de las tres estrategias a 5 anos"),

          bp("La tabla anterior muestra que la Estrategia C supera a las alternativas en todos los indicadores financieros relevantes. Aunque requiere la misma inversion total que la Estrategia A (RD$6,961,822, ya que realiza el mismo numero de reemplazos), genera significativamente mas ingresos gracias a la produccion continua. Los ingresos por huevos de la Estrategia C (RD$54,912,000) superan a la Estrategia A (RD$44,616,000) en RD$10,296,000, una diferencia que representa exactamente el valor de los huevos que se dejarían de producir durante los periodos de transicion."),

          bp("La Estrategia B, a pesar de requerir menor inversion (RD$6,721,822 por realizar un reemplazo menos), no logra igualar a la Estrategia C porque los dos meses adicionales de produccion decreciente no compensan la perdida de un ciclo completo. Ademas, la Estrategia B solo vende 1,400,000 gallinas (7 batches) contra las 1,600,000 de las estrategias A y C (8 batches), perdiendo RD$200,000 en ingreso por venta de desecho."),

          chartP("chart_compare_cashflow.png"),
          capP("Figura 2: Flujo de caja acumulado comparativo a 60 meses"),

          bp("La grafica de flujo de caja acumulado revela que las tres estrategias comparten el mismo punto de equilibrio (mes 19) y el mismo deficit maximo (-RD$4,464,078), ya que las diferencias solo se manifiestan a partir del mes 25 cuando comienza el primer reemplazo. A partir de ese punto, la Estrategia C se separa progresivamente de las alternativas, acumulando diferencia de forma acelerada. Al mes 60, la brecha entre la Estrategia C y la Estrategia A alcanza RD$5.5 millones."),

          costTable,
          capP("Tabla 2: Distribucion porcentual de gastos por categoria y estrategia"),

          // ═══ 5. DETALLE ESTRATEGIA C ═══
          h1("5. Detalle de la Estrategia Recomendada"),

          h2("5.1 Ingresos por Fuente"),
          bp("La Estrategia C diversifica las fuentes de ingreso al combinar la venta continua de huevos con ingresos periodicos por venta de gallinas de desecho. La venta de huevos representa el 97.2% de los ingresos totales (RD$54,912,000), mientras que la venta de gallinas aporta el 2.8% restante (RD$1,600,000). Aunque el ingreso por gallinas parece marginal, su contribucion al flujo de caja es significativa porque ocurre precisamente en los momentos de transicion entre ciclos, cuando los costos de cria de las nuevas pollitas generan demanda de efectivo."),

          chartP("chart_c_annual_revenue.png"),
          capP("Figura 3: Ingresos anuales de la Estrategia C desglosados por fuente"),

          bp("Los ingresos por huevos se estabilizan en RD$12,672,000 anuales a partir del ano 2, un nivel de ingresos constante que refleja la produccion continua de los 4 galpones. La venta de gallinas genera ingresos en los anos 3, 4 y 5, coincidiendo con la finalizacion del primer y segundo ciclo de cada batch. Este patron de ingresos predecible facilita la planificacion financiera y la gestion de flujo de caja."),

          h2("5.2 Resultado Neto Anual"),
          chartP("chart_c_annual_profit.png"),
          capP("Figura 4: Resultado neto anual y acumulado de la Estrategia C"),

          annTable,
          capP("Tabla 3: Resultado financiero anual de la Estrategia C"),

          bp("El ano 1 registra una perdida de RD$3,517,770, identica a las otras estrategias, ya que durante este periodo no ocurren reemplazos. A partir del ano 2, la Estrategia C muestra su ventaja: genera RD$4,881,045 de beneficio neto (vs. RD$5,892,000 de la Estrategia A que tiene un ano 2 excepcional sin gastos de reemplazo). Sin embargo, la diferencia real se observa a partir del ano 3, cuando las Estrategias A y B comienzan a sufrir periodos de transicion mientras la Estrategia C mantiene produccion plena."),

          bp("Los anos 3, 4 y 5 generan beneficios netos de RD$4,678,767, RD$3,768,951 y RD$5,790,861 respectivamente. La reduccion en el ano 4 se debe a que en este periodo coinciden varios reemplazos, incrementando temporalmente los costos de cria. El ano 5 muestra el mejor resultado gracias a la madurez del segundo ciclo con menores costos de transicion. El beneficio acumulado al cierre del ano 5 alcanza RD$15,601,854."),

          h2("5.3 Flujo de Caja Mensual Detallado"),
          chartP("chart_c_monthly_detail.png"),
          capP("Figura 5: Detalle mensual de la Estrategia C a 60 meses"),

          bp("El detalle mensual revela patrones operativos importantes. Los meses con mayor salida de caja son aquellos donde coinciden reemplazos de cria anticipada con costos operativos normales, como los meses 20, 24, 44, 49 y 54. En estos meses, el gasto total puede alcanzar RD$1,074,977 (meses 24 y 44), donde se superponen los costos de cria de un nuevo batch con los costos operativos de produccion plena. Sin embargo, incluso en estos meses de mayor gasto, el flujo neto se mantiene cercano a cero gracias a los ingresos continuos por huevos."),

          bp("Los meses de venta de gallinas (25, 45, 50, 55 y 60) generan picos de ingreso que compensan sobradamente los costos de transicion. Por ejemplo, en el mes 25, la venta de 2,000 gallinas aporta RD$200,000 adicionales que sumados a los ingresos por huevos de RD$1,056,000 generan un ingreso total de RD$1,256,000. Este patron de inyeccion de efectivo periodico es una ventaja adicional de la estrategia de reemplazo ciclico."),

          // ═══ 6. IMPLEMENTACION ═══
          h1("6. Plan de Implementacion de la Estrategia C"),

          h2("6.1 Requisitos de Infraestructura"),
          bp("El unico requisito adicional de la Estrategia C respecto al plan original es un area de cria y brooding separada de los galpones de postura. Esta area no necesita ser un galpon completo; un espacio techado de aproximadamente 30-40 metros cuadrados con control de temperatura (criadoras de gas o electricas), bebederos y comederos adecuados para pollitas es suficiente. La inversion estimada para esta area es de RD$50,000-80,000, una fraccion minima comparada con el beneficio adicional de RD$5.5 millones que genera la Estrategia C a 5 anos."),

          h2("6.2 Cronograma de Reemplazos"),
          bp("El cronograma de reemplazos sigue un patron escalonado determinado por la estructura original de 4 batches iniciados cada 2 meses. El primer reemplazo comienza en el mes 20 (5 meses antes de vender el Batch 1 en el mes 25). Los reemplazos subsiguientes se escalonan cada 2 meses, manteniendo la sincronizacion original. Cada galpon completa exactamente 2 ciclos productivos completos dentro del periodo de 5 anos."),

          bp("El calendario critico de transiciones para el primer ciclo de reemplazos es: Galpon 1 (cria M20, venta M25), Galpon 2 (cria M22, venta M27), Galpon 3 (cria M24, venta M29) y Galpon 4 (cria M26, venta M31). Para el segundo ciclo: Galpon 1 (cria M44, venta M49), Galpon 2 (cria M46, venta M51), Galpon 3 (cria M48, venta M53) y Galpon 4 (cria M50, venta M55). Al mes 60, los Galpones 3 y 4 estan en su tercer ciclo de cria con produccion parcial."),

          h2("6.3 Gestion del Flujo de Caja"),
          bp("La Estrategia C requiere mayor disponibilidad de capital durante los meses de reemplazo, ya que se pagan los costos de cria de nuevas pollitas mientras se mantienen los costos operativos de las gallinas en postura. El deficit maximo de la Estrategia C es identico al de las otras estrategias (-RD$4,464,078 al mes 8), pero los picos de gasto recurrente en los meses de reemplazo (RD$1,074,977) requieren una reserva de efectivo operativa de al menos RD$500,000-700,000 para cubrir las variaciones mensuales sin tensiones de liquidez."),

          infoBox("Recomendacion de Liquidez",
            "Mantener una linea de credito o reserva de efectivo de RD$700,000 para cubrir los picos de gasto en meses de reemplazo. Los ingresos mensuales promedio de RD$1,056,000 durante plena operacion permiten reconstituir rapidamente esta reserva."),
          new Paragraph({spacing:{before:200},children:[]}),

          // ═══ 7. RIESGOS ═══
          h1("7. Riesgos y Consideraciones"),

          bpB("Mortalidad durante la cria: ", "La cria anticipada asume que las pollitas de reemplazo sobreviviran en su totalidad durante los 5 meses de brooding. Una mortalidad superior al 5% durante esta fase reducira el numero de aves disponibles para postura y los ingresos proyectados. Se recomienda un manejo estricto de bioseguridad y temperatura durante la cria."),

          bpB("Variacion del precio de venta de gallinas: ", "El modelo asume RD$100 por gallina de desecho, pero este precio puede fluctuar segun la oferta y demanda del mercado. Una caida a RD$70-80 reduciria los ingresos por venta de gallinas en RD$40,000-60,000 por batch, impactando marginalmente la rentabilidad total."),

          bpB("Disponibilidad de pollitas WD80: ", "La estrategia requiere adquirir pollitas de reemplazo con 5 meses de anticipacion. La disponibilidad de pollitas WD80 de calidad debe confirmarse con el proveedor con al menos 6 meses de antelacion para cada ciclo de reemplazo."),

          bpB("Espacio de brooding: ", "Si la granja no cuenta con un area de cria separada, la construccion de esta debe completarse antes del mes 15 para estar lista para el primer reemplazo en el mes 20. Una alternativa temporal es utilizar una seccion dividida de uno de los galpones, aunque esto reduce temporalmente la capacidad de postura."),

          bpB("Enfermedades en la transicion: ", "El traslado de pollitas nuevas al galpon que fue ocupado por gallinas viejas requiere una limpieza y desinfeccion exhaustiva (minimo 7-10 dias) para prevenir la transmision de patogenos. Un brote de enfermedad durante la transicion podria afectar tanto a las gallinas entrantes como a las de galpones vecinos."),

          // ═══ 8. CONCLUSIONES ═══
          h1("8. Conclusiones"),

          bp("El analisis comparativo de tres estrategias de reemplazo ciclico a 5 anos demuestra que la Estrategia C (cria anticipada) es significativamente superior a las alternativas convencionales. Con un beneficio neto de RD$15,601,854 y un ROI del 224%, esta estrategia genera un 55% mas de retorno que el reemplazo inmediato (Estrategia A) y un 37% mas que el ciclo extendido (Estrategia B)."),

          bp("La ventaja competitiva de la Estrategia C se fundamenta en la eliminacion de los periodos de inactividad productiva que son inherentes a los modelos de reemplazo tradicional. Al adquirir las pollitas de reemplazo 5 meses antes de la venta de las gallinas viejas, la produccion de huevos se mantiene continua, maximizando la utilizacion de la infraestructura (4 galpones) y generando ingresos de forma ininterrumpida."),

          bp("La implementacion de esta estrategia requiere una inversion menor adicional (RD$50,000-80,000 en area de brooding) y una gestion mas sofisticada del flujo de caja, pero el retorno adicional de RD$5.5 millones a 5 anos justifica ampliamente estos requerimientos. Para el productor que busca maximizar la rentabilidad de su operacion avicola, la cria anticipada representa la mejor practica de la industria y la estrategia mas recomendable."),
        ] },
    ] });

  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(DOCX_OUT, buf);
  console.log("Document generated:", DOCX_OUT);
}

main().catch(e => { console.error(e); process.exit(1); });
