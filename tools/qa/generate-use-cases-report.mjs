import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import {
  contractHeaders,
  findingsHeaders,
  reportMeta,
  reportSections,
  buildContractRows,
  buildFindingTemplateRows,
} from "./use-cases-report.source.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const outputDir = path.join(repoRoot, "docs", "qa");
const outputPath = path.join(outputDir, "system-use-cases-report.xlsx");

const require = createRequire(import.meta.url);
const XLSX = require(path.join(repoRoot, "backend", "node_modules", "xlsx"));

const headers = [
  "ID",
  "Funcionalidad",
  "Caso de uso",
  "Cobertura",
  "Precondiciones",
  "Disparador / pasos",
  "Resultado esperado",
  "Estado de la prueba",
  "Estado backend directo",
  "Evidencia",
  "Siguiente acción",
  "Última validación",
];

const statusOrder = ["VERIFICADA", "DEFINIDA", "PENDIENTE"];
const surfaceOrder = [
  "validado por UI",
  "validado por API directa",
  "pendiente de backend",
  "definido pero no cubierto",
];
const manualGuideOrder = [
  "pendiente de backend",
  "definido pero no cubierto",
  "validado por API directa",
  "validado por UI",
];
const surfaceOverrides = new Map([
  ["ECOM-AUTH-012", "validado por API directa"],
  ["ECOM-AUTH-013", "validado por API directa"],
  ["ECOM-AUTH-014", "validado por API directa"],
  ["CHAT-RT-034", "validado por API directa"],
  ["CHAT-RT-037", "validado por API directa"],
  ["CROSS-017", "validado por API directa"],
  ["CROSS-018", "validado por API directa"],
  ["SEC-020", "validado por API directa"],
  ["SEC-021", "validado por API directa"],
]);

function normalizeText(value) {
  return value == null ? "" : String(value);
}

function buildSectionRows(section) {
  return section.cases.map((item) => ({
    ID: item.id,
    Funcionalidad: item.functionality,
    "Caso de uso": item.useCase,
    Cobertura: item.coverage,
    Precondiciones: item.preconditions,
    "Disparador / pasos": item.trigger,
    "Resultado esperado": item.expected,
    "Estado de la prueba": item.status,
    "Estado backend directo": inferBackendSurfaceState(item),
    Evidencia: item.evidence,
    "Siguiente acción": item.nextAction,
    "Última validación": item.lastValidated || "",
  }));
}

function inferBackendSurfaceState(item) {
  const override = surfaceOverrides.get(item.id);
  if (override) {
    return override;
  }

  const evidence = `${item.evidence} ${item.coverage} ${item.nextAction}`.toLowerCase();
  const directBackendSignals = [
    'backend/src',
    '__tests__',
    '/api/',
    '/dto/',
    'dto-validation',
    'channel-control',
    'inbox.service',
    'storefront.service',
    'admin-conversations',
    'channel-conversation-bridge',
    'auth.dto',
    'storefront/dto',
  ];
  const hasDirectBackendSignal = directBackendSignals.some((signal) => evidence.includes(signal));
  const hasUiSignal = /(\be2e\b|\bui\b|frontend\/src|\.tsx\b|storefront\/src|ecommerce\/src)/i.test(evidence);

  if (item.status === 'VERIFICADA') {
    if (hasDirectBackendSignal) {
      return 'validado por API directa';
    }
    if (hasUiSignal) {
      return 'validado por UI';
    }
  }

  if (item.status === 'DEFINIDA') {
    if (hasDirectBackendSignal) {
      return 'pendiente de backend';
    }
    return 'definido pero no cubierto';
  }

  if (item.status === 'PENDIENTE') {
    if (hasDirectBackendSignal) {
      return 'pendiente de backend';
    }
    return 'definido pero no cubierto';
  }

  return 'definido pero no cubierto';
}

function countByStatus(section) {
  const counts = Object.fromEntries(statusOrder.map((status) => [status, 0]));
  for (const item of section.cases) {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
  }
  return counts;
}

function countBySurface(section) {
  const counts = Object.fromEntries(surfaceOrder.map((state) => [state, 0]));
  for (const item of section.cases) {
    const state = inferBackendSurfaceState(item);
    counts[state] = (counts[state] ?? 0) + 1;
  }
  return counts;
}

function buildSummaryRows() {
  const rows = [];
  rows.push(["Título", reportMeta.title]);
  rows.push(["Generado", reportMeta.generatedAt]);
  rows.push(["Baseline", reportMeta.baselineCommit]);
  rows.push(["Comando de regeneración", reportMeta.updateCommand]);
  rows.push(["Notas", reportMeta.notes]);
  rows.push([]);
  rows.push(["Proyecto", "Total", "Verificadas", "Definidas", "Pendientes", ...surfaceOrder]);

  for (const section of reportSections) {
    const counts = countByStatus(section);
    const surfaces = countBySurface(section);
    rows.push([
      section.project,
      section.cases.length,
      counts.VERIFICADA,
      counts.DEFINIDA,
      counts.PENDIENTE,
      surfaces["validado por UI"],
      surfaces["validado por API directa"],
      surfaces["pendiente de backend"],
      surfaces["definido pero no cubierto"],
    ]);
  }

  rows.push([]);
  rows.push(["Leyenda", "VERIFICADA = corrida o validación real ya cerrada"]);
  rows.push(["Leyenda", "DEFINIDA = existe cobertura alineada, pero falta rerun final en este informe"]);
  rows.push(["Leyenda", "PENDIENTE = el caso existe como superficie del sistema y falta cobertura suficiente"]);

  return rows;
}

function setTableLayout(sheet, columnWidths, rowCount, headerCount = headers.length) {
  sheet["!cols"] = columnWidths.map((width) => ({ wch: width }));
  sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rowCount, c: headerCount - 1 } }) };
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
}

function autoWidth(rows, rowHeaders, min = 12, max = 48) {
  return rowHeaders.map((header) => {
    let longest = String(header).length;
    for (const row of rows) {
      const value = normalizeText(row[header]);
      longest = Math.max(longest, value.length);
    }
    return Math.max(min, Math.min(max, Math.ceil(longest * 0.95)));
  });
}

function buildWorkbook() {
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: reportMeta.title,
    Subject: "Detalle granular de casos de uso y estado de pruebas",
    Author: "Codex",
    CreatedDate: new Date(`${reportMeta.generatedAt}T00:00:00-03:00`),
    Company: "Codex",
    Keywords: "qa,excel,system use cases,testing",
  };

  const summaryRows = buildSummaryRows();
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [
    { wch: 30 },
    { wch: 92 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 24 },
    { wch: 22 },
    { wch: 26 },
  ];
  workbook.SheetNames.push("Resumen");
  workbook.Sheets.Resumen = summarySheet;

  const contractRows = buildContractRows();
  const contractAoA = [contractHeaders, ...contractRows.map((row) => contractHeaders.map((header) => row[header]))];
  const contractSheet = XLSX.utils.aoa_to_sheet(contractAoA);
  setTableLayout(contractSheet, autoWidth(contractRows, contractHeaders, 14, 52), contractRows.length, contractHeaders.length);
  workbook.SheetNames.push("Contrato vivo");
  workbook.Sheets["Contrato vivo"] = contractSheet;

  const findingsRows = buildFindingTemplateRows();
  const findingsAoA = [findingsHeaders, ...findingsRows.map((row) => findingsHeaders.map((header) => row[header]))];
  const findingsSheet = XLSX.utils.aoa_to_sheet(findingsAoA);
  setTableLayout(findingsSheet, autoWidth(findingsRows, findingsHeaders, 14, 52), findingsRows.length, findingsHeaders.length);
  workbook.SheetNames.push("Hallazgos");
  workbook.Sheets.Hallazgos = findingsSheet;

  const guideRows = [];
  guideRows.push([
    "Proyecto",
    "ID",
    "Funcionalidad",
    "Caso de uso",
    "Estado de la prueba",
    "Estado backend directo",
    "Precondiciones",
    "Disparador / pasos",
    "Resultado esperado",
    "Evidencia",
    "Siguiente acción",
  ]);

  const guideEntries = reportSections
    .filter((section) => section.sheetName !== "Chat Platform" && String(section.project).toLowerCase() !== "chat platform")
    .flatMap((section) =>
      section.cases.map((item) => ({
        project: section.project,
        ...item,
        backendState: inferBackendSurfaceState(item),
      })),
    );

  guideEntries
    .sort((left, right) => {
      const surfaceDiff =
        manualGuideOrder.indexOf(left.backendState) - manualGuideOrder.indexOf(right.backendState);
      if (surfaceDiff !== 0) {
        return surfaceDiff;
      }
      const statusDiff = statusOrder.indexOf(left.status) - statusOrder.indexOf(right.status);
      if (statusDiff !== 0) {
        return statusDiff;
      }
      return `${left.project} ${left.id}`.localeCompare(`${right.project} ${right.id}`);
    })
    .forEach((item) => {
      guideRows.push([
        item.project,
        item.id,
        item.functionality,
        item.useCase,
        item.status,
        item.backendState,
        item.preconditions,
        item.trigger,
        item.expected,
        item.evidence,
        item.nextAction,
      ]);
    });

  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
  guideSheet["!cols"] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 22 },
    { wch: 52 },
    { wch: 18 },
    { wch: 24 },
    { wch: 42 },
    { wch: 42 },
    { wch: 58 },
    { wch: 52 },
    { wch: 26 },
  ];
  guideSheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(0, guideRows.length - 1), c: 10 },
    }),
  };
  guideSheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  workbook.SheetNames.push("Guia manual");
  workbook.Sheets["Guia manual"] = guideSheet;

  for (const section of reportSections) {
    const rows = buildSectionRows(section);
    const aoa = [headers, ...rows.map((row) => headers.map((header) => row[header]))];
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    setTableLayout(sheet, autoWidth(rows, headers), rows.length, headers.length);
    workbook.SheetNames.push(section.sheetName);
    workbook.Sheets[section.sheetName] = sheet;
  }

  return workbook;
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const workbook = buildWorkbook();
  XLSX.writeFile(workbook, outputPath, { bookType: "xlsx", compression: true });
  console.log(JSON.stringify({ outputPath, sheets: workbook.SheetNames, sections: reportSections.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
