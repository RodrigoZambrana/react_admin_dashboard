import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Workbook, SpreadsheetFile } from "@oai/artifact-tool";
import { reportSections } from "./use-cases-report.source.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const outputDir = path.join(repoRoot, "outputs", "ecommerce-test-tracker");
const outputPath = path.join(outputDir, "ecommerce-test-tracker.xlsx");

const sections = ["Ecommerce", "Admin", "Cross-project"];
const rows = reportSections
  .filter((section) => sections.includes(section.sheetName))
  .flatMap((section) =>
    section.cases.map((testCase) => ({
      area: testCase.coverage,
      id: testCase.id,
      bloque: testCase.functionality,
      caso: testCase.useCase,
      cobertura: testCase.coverage,
      precondiciones: testCase.preconditions,
      accion: testCase.trigger,
      esperado: testCase.expected,
      estado: "",
      resultado_real: "",
      observaciones: "",
      evidencia: testCase.evidence,
      ultima_validacion: testCase.lastValidated || "",
      seccion: section.sheetName,
      next_action: testCase.nextAction,
    })),
  );

const workbook = Workbook.create();
const resumen = workbook.worksheets.add("Resumen");
const tracker = workbook.worksheets.add("Pruebas");
const leyenda = workbook.worksheets.add("Leyenda");

tracker.showGridLines = false;
resumen.showGridLines = false;
leyenda.showGridLines = false;

const header = [
  "Seccion",
  "ID",
  "Area",
  "Bloque",
  "Caso",
  "Cobertura",
  "Precondiciones",
  "Accion / disparador",
  "Resultado esperado",
  "Estado",
  "Resultado real",
  "Observaciones",
  "Evidencia",
  "Ultima validacion",
  "Siguiente accion",
];

const data = [header, ...rows.map((row) => [
  row.seccion,
  row.id,
  row.area,
  row.bloque,
  row.caso,
  row.cobertura,
  row.precondiciones,
  row.accion,
  row.esperado,
  row.estado,
  row.resultado_real,
  row.observaciones,
  row.evidencia,
  row.ultima_validacion,
  row.next_action,
])];

tracker.getRange(`A1:O${data.length}`).values = data;

const summaryTitle = [
  ["Tracker de pruebas ecommerce"],
  ["Estado operativo para registrar cada caso como OK, requiere ajuste o bloqueado."],
  [""],
];
resumen.getRange("A1:A3").values = summaryTitle;

resumen.getRange("A5:A10").values = [
  ["Total de casos"],
  ["OK"],
  ["Requiere ajuste"],
  ["Bloqueado"],
  ["Pendientes"],
  ["Cobertura completa"],
];
resumen.getRange("B5:B10").formulas = [
  [`=COUNTA(Pruebas!B2:B${rows.length + 1})`],
  [`=COUNTIF(Pruebas!J2:J${rows.length + 1},"OK")`],
  [`=COUNTIF(Pruebas!J2:J${rows.length + 1},"Requiere ajuste")`],
  [`=COUNTIF(Pruebas!J2:J${rows.length + 1},"Bloqueado")`],
  [`=COUNTIF(Pruebas!J2:J${rows.length + 1},"")`],
  [`=IF(B5=0,"",B6/B5)`],
];

const sectionBreakdownHeader = [["Seccion", "Casos"]];
resumen.getRange("D5:E5").values = sectionBreakdownHeader;
resumen.getRange(`D6:D${5 + sections.length}`).values = sections.map((section) => [section]);
resumen.getRange(`E6:E${5 + sections.length}`).formulas = sections.map(
  (_, index) => [`=COUNTIF(Pruebas!A2:A${rows.length + 1},D${6 + index})`],
);

const statusLegend = [
  ["Estado", "Uso"],
  ["OK", "Validado y sin desvio funcional"],
  ["Requiere ajuste", "Funciona con diferencia o correccion pendiente"],
  ["Bloqueado", "No se pudo ejecutar por dependencia o error tecnico"],
  ["Pendiente", "Aun no probado"],
];
leyenda.getRange("A1:B5").values = statusLegend;

// Formatting
const trackerHeader = tracker.getRange(`A1:O1`);
trackerHeader.format.font.bold = true;
trackerHeader.format.font.color = "#ffffff";
trackerHeader.format.fill.color = "#1f2937";
trackerHeader.format.horizontalAlignment = "center";
trackerHeader.format.verticalAlignment = "middle";
trackerHeader.format.wrapText = true;
trackerHeader.format.rowHeightPx = 30;

const bodyRange = tracker.getRange(`A2:O${rows.length + 1}`);
bodyRange.format.verticalAlignment = "top";
bodyRange.format.wrapText = true;
bodyRange.format.autofitRows();

const colors = {
  ok: "#dcfce7",
  ajust: "#fef3c7",
  blocked: "#fee2e2",
  pending: "#e5e7eb",
};

// Status column base styling; manual selection will remain readable.
tracker.getRange(`J2:J${rows.length + 1}`).format.horizontalAlignment = "center";
tracker.getRange(`J2:J${rows.length + 1}`).format.font.bold = true;
tracker.getRange(`J2:J${rows.length + 1}`).dataValidation = {
  allowBlank: true,
  list: {
    inCellDropDown: true,
    source: ["Pendiente", "OK", "Requiere ajuste", "Bloqueado"],
  },
  errorAlert: {
    style: "stop",
    title: "Estado invalido",
    message: "Usa uno de los valores estandar de la lista.",
  },
};

tracker.getRange(`K2:K${rows.length + 1}`).dataValidation = {
  allowBlank: true,
  list: {
    inCellDropDown: true,
    source: ["OK", "Requiere ajuste", "Bloqueado", "No ejecutado"],
  },
  errorAlert: {
    style: "stop",
    title: "Resultado invalido",
    message: "Usa uno de los valores estandar de la lista.",
  },
};

resumen.getRange("A1:B1").merge();
resumen.getRange("A2:B2").merge();
resumen.getRange("A1").format.font.bold = true;
resumen.getRange("A1").format.font.size = 18;
resumen.getRange("A2").format.font.color = "#4b5563";
resumen.getRange("A5:B10").format.wrapText = true;
resumen.getRange("A5:A10").format.font.bold = true;
resumen.getRange("D5:E8").format.wrapText = true;
resumen.getRange("D5:E5").format.font.bold = true;
resumen.getRange("A5:B10").format.borders.setPreset("all");
resumen.getRange("D5:E8").format.borders.setPreset("all");
resumen.getRange("A5:B10").format.fill.color = "#f9fafb";
resumen.getRange("D5:E8").format.fill.color = "#f9fafb";

leyenda.getRange("A1:B1").format.font.bold = true;
leyenda.getRange("A1:B1").format.fill.color = "#1f2937";
leyenda.getRange("A1:B1").format.font.color = "#ffffff";
leyenda.getRange("A1:B5").format.borders.setPreset("all");
leyenda.getRange("A1:B5").format.wrapText = true;

// Dimensions
const widths = [
  ["A", 140],
  ["B", 130],
  ["C", 130],
  ["D", 150],
  ["E", 360],
  ["F", 120],
  ["G", 260],
  ["H", 220],
  ["I", 220],
  ["J", 140],
  ["K", 180],
  ["L", 220],
  ["M", 220],
  ["N", 120],
  ["O", 160],
];
for (const [col, widthPx] of widths) {
  tracker.getRange(`${col}1`).format.columnWidthPx = widthPx;
}

resumen.getRange("A1").format.columnWidthPx = 520;
resumen.getRange("A2").format.columnWidthPx = 520;
resumen.getRange("A5").format.columnWidthPx = 220;
resumen.getRange("B5").format.columnWidthPx = 140;
resumen.getRange("D5").format.columnWidthPx = 220;
resumen.getRange("E5").format.columnWidthPx = 140;
leyenda.getRange("A1").format.columnWidthPx = 180;
leyenda.getRange("B1").format.columnWidthPx = 420;

// Freeze and basic validation helpers.
tracker.freezePanes.freezeRows(1);
tracker.freezePanes.freezeColumns(1);
tracker.getRange(`A1:O${rows.length + 1}`).format.autofitRows();

// Place formulas as text where appropriate and apply numeric formats.
resumen.getRange("B5:B9").format.numberFormat = "0";
resumen.getRange("B10").format.numberFormat = "0.0%";
resumen.getRange(`E6:E${5 + sections.length}`).format.numberFormat = "0";

// Visual status notes.
resumen.getRange("A12").values = [["Criterio de reporte"]];
resumen.getRange("A13").values = [[
  "Completa la columna Estado con: OK, Requiere ajuste, Bloqueado o Pendiente. Usa Observaciones y Evidencia para dejar trazabilidad operativa.",
]];
resumen.getRange("A12:B12").merge();
resumen.getRange("A13:B13").merge();
resumen.getRange("A12").format.font.bold = true;
resumen.getRange("A12").format.fill.color = "#dbeafe";
resumen.getRange("A13").format.wrapText = true;
resumen.getRange("A12:B13").format.borders.setPreset("all");
resumen.getRange("A12:B13").format.columnWidthPx = 720;
resumen.getRange("A12").format.rowHeightPx = 28;
resumen.getRange("A13").format.rowHeightPx = 48;

// Simplify summary layout.
resumen.freezePanes.freezeRows(4);
resumen.getRange("A1:B2").format.horizontalAlignment = "left";

await fs.mkdir(outputDir, { recursive: true });
const exported = await SpreadsheetFile.exportXlsx(workbook);
await exported.save(outputPath);

console.log(outputPath);
