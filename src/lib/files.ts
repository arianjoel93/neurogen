import { jsPDF } from "jspdf";
import readXlsxFile from "read-excel-file/browser";
import writeXlsxFile from "write-excel-file/browser";
import type { SheetData } from "write-excel-file/browser";
import type { ActivityLog, ImportPreview, Metrics, Patient, ReportFilters } from "../types";
import { calculateMetrics } from "./analytics";
import { getPatientFullName, mapSpreadsheetRows } from "./normalization";

type ExcelValue = string | number | boolean | Date | null;
type ExcelRecord = Record<string, ExcelValue>;

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

function patientToRow(patient: Patient): ExcelRecord {
  return {
    Nombre: patient.firstName,
    Apellidos: patient.lastName,
    Edad: patient.age ?? null,
    Sexo: patient.sex ?? "",
    Localidad: patient.locality ?? "",
    Estado: patient.state ?? "",
    Vivienda: patient.housingType ?? "",
    "Material Vivienda": patient.housingMaterial ?? "",
    Agua: patient.waterAccess ?? "",
    Saneamiento: patient.sanitation ?? "",
    Hacinamiento: patient.overcrowding === undefined ? "" : patient.overcrowding ? "Si" : "No",
    "Condiciones De Vida": patient.lifeConditions ?? "",
    "Código Muestra": patient.sampleCode ?? "",
    Diagnóstico: patient.diagnosis ?? "",
    "Estudio Genético": patient.geneticStudy ?? "",
    "Antecedentes Familiares": patient.familyHistory ?? "",
    Teléfono: patient.contactPhone ?? "",
    "Notas Clínicas": patient.clinicalNotes ?? "",
    "Creado Por": patient.createdByName,
    "Correo Creador": patient.createdByEmail,
    "Fecha Registro": dateFormatter.format(new Date(patient.createdAt)),
  };
}

function makeHeader(value: string) {
  return {
    value,
    fontWeight: "bold" as const,
    color: "#ffffff",
    backgroundColor: "#134e4a",
  };
}

function recordsToSheet(records: ExcelRecord[], headers: string[]): SheetData {
  return [
    headers.map(makeHeader),
    ...records.map((record) => headers.map((header) => record[header] ?? "")),
  ];
}

function bucketRecords(title: string, buckets: Metrics["byState"]): ExcelRecord[] {
  return buckets.map((bucket) => ({
    [title]: bucket.label,
    Registros: bucket.value,
    Porcentaje: `${bucket.percent}%`,
  }));
}

function rowsToObjects(rows: unknown[][]) {
  const [headersRow, ...bodyRows] = rows;
  const headers = headersRow?.map((header) => String(header ?? "").trim()) ?? [];

  return bodyRows
    .filter((row) => row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""))
    .map((row) =>
      headers.reduce<Record<string, unknown>>((record, header, index) => {
        if (header) {
          record[header] = row[index] ?? "";
        }
        return record;
      }, {}),
    );
}

function parseDelimited(text: string, delimiter: "," | "\t") {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && insideQuotes && nextCharacter === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === delimiter && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);
  return rows;
}

export async function readPatientsFromFile(file: File): Promise<ImportPreview> {
  const lowerName = file.name.toLocaleLowerCase("es-MX");
  const rows =
    lowerName.endsWith(".csv") || lowerName.endsWith(".tsv")
      ? parseDelimited(await file.text(), lowerName.endsWith(".tsv") ? "\t" : ",")
      : await readXlsxFile(file);
  const mapped = mapSpreadsheetRows(rowsToObjects(rows as unknown[][]));

  return {
    fileName: file.name,
    ...mapped,
  };
}

export async function exportDashboardWorkbook(patients: Patient[], logs: ActivityLog[]) {
  const metrics = calculateMetrics(patients);
  const summary: ExcelRecord[] = [
    { Métrica: "Pacientes", Valor: metrics.totalPatients },
    { Métrica: "Edad Promedio", Valor: metrics.averageAge },
    { Métrica: "Edad Mediana", Valor: metrics.medianAge },
    { Métrica: "Edad Mínima", Valor: metrics.minAge },
    { Métrica: "Edad Máxima", Valor: metrics.maxAge },
    { Métrica: "Registros Ultimos 7 Dias", Valor: metrics.recentPatients },
    { Métrica: "Datos De Vivienda Completos", Valor: `${metrics.housingCompleteness}%` },
  ];
  const patientRows = patients.map(patientToRow);
  const logRows: ExcelRecord[] = logs.map((log) => ({
    Acción: log.action,
    Usuario: log.actorName,
    Correo: log.actorEmail,
    Resumen: log.summary,
    Fecha: dateFormatter.format(new Date(log.createdAt)),
  }));

  await writeXlsxFile([
    {
      data: recordsToSheet(summary, ["Métrica", "Valor"]),
      sheet: "Dashboard",
      stickyRowsCount: 1,
    },
    {
      data: recordsToSheet(bucketRecords("Estado", metrics.byState), ["Estado", "Registros", "Porcentaje"]),
      sheet: "Por Estado",
      stickyRowsCount: 1,
    },
    {
      data: recordsToSheet(bucketRecords("Localidad", metrics.byLocality), ["Localidad", "Registros", "Porcentaje"]),
      sheet: "Por Localidad",
      stickyRowsCount: 1,
    },
    {
      data: recordsToSheet(bucketRecords("Sexo", metrics.bySex), ["Sexo", "Registros", "Porcentaje"]),
      sheet: "Por Sexo",
      stickyRowsCount: 1,
    },
    {
      data: recordsToSheet(patientRows, Object.keys(patientToRow(patients[0] ?? ({} as Patient)))),
      sheet: "Pacientes",
      stickyRowsCount: 1,
    },
    {
      data: recordsToSheet(logRows, ["Acción", "Usuario", "Correo", "Resumen", "Fecha"]),
      sheet: "Registros",
      stickyRowsCount: 1,
    },
  ]).toFile(`dashboard-laboratorio-genética-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function drawKeyValue(doc: jsPDF, label: string, value: string | number, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.text(label, x, y);
  doc.setFont("helvetica", "normal");
  doc.text(String(value), x, y + 6);
}

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, width: number) {
  const lines = doc.splitTextToSize(text, width) as string[];
  doc.text(lines, x, y);
  return y + lines.length * 5;
}

function maskValue(value?: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "S***";
  }

  return normalized
    .split(" ")
    .map((part) => (part ? `${part[0]}${"*".repeat(Math.max(part.length - 1, 3))}` : ""))
    .join(" ");
}

export function exportReportPdf(patients: Patient[], filters: ReportFilters) {
  const metrics = calculateMetrics(patients);
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const generatedAt = dateFormatter.format(new Date());

  doc.setProperties({
    title: "Reporte Laboratorio De Genética Humana",
    subject: "Pacientes filtrados",
  });

  doc.setFillColor(19, 78, 74);
  doc.rect(0, 0, 216, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Reporte De Pacientes", 14, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Laboratorio De Genética Humana - ${generatedAt}`, 14, 23);

  doc.setTextColor(25, 34, 43);
  doc.setFontSize(10);
  drawKeyValue(doc, "Pacientes", metrics.totalPatients, 14, 48);
  drawKeyValue(doc, "Edad Promedio", metrics.averageAge || "Sin dato", 58, 48);
  drawKeyValue(doc, "Mediana", metrics.medianAge || "Sin dato", 104, 48);
  drawKeyValue(doc, "Rango Edad", metrics.totalPatients ? `${metrics.minAge}-${metrics.maxAge}` : "Sin dato", 146, 48);

  doc.setDrawColor(216, 226, 234);
  doc.line(14, 66, 202, 66);

  doc.setFont("helvetica", "bold");
  doc.text("Filtros Aplicados", 14, 76);
  doc.setFont("helvetica", "normal");
  const activeFilters = [
    filters.search ? "Búsqueda: aplicada" : "",
    filters.state ? `Estado: ${filters.state}` : "",
    filters.sex ? `Sexo: ${filters.sex}` : "",
    filters.from ? `Desde: ${filters.from}` : "",
    filters.to ? `Hasta: ${filters.to}` : "",
  ].filter(Boolean);
  doc.text(activeFilters.length ? activeFilters.join("  |  ") : "Sin filtros", 14, 84);

  doc.setFont("helvetica", "bold");
  doc.text("Distribución Principal", 14, 98);
  doc.setFont("helvetica", "normal");
  let y = 106;
  metrics.byState.slice(0, 5).forEach((bucket) => {
    doc.text(`${bucket.label}: ${bucket.value} (${bucket.percent}%)`, 14, y);
    y += 6;
  });

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text("Datos Médicos Añonimizados", 14, y);
  y += 8;
  doc.setFont("helvetica", "normal");

  patients.forEach((patient, index) => {
    if (y > 250) {
      doc.addPage();
      y = 18;
    }

    doc.setFont("helvetica", "bold");
    doc.text(`${index + 1}. Paciente ${maskValue(getPatientFullName(patient))}`, 14, y);
    doc.setFont("helvetica", "normal");
    y += 6;
    y = addWrappedText(
      doc,
      [
        `Edad: ${patient.age ?? "Sin dato"}`,
        `Sexo: ${patient.sex || "Sin dato"}`,
        `Código muestra: ${patient.sampleCode ? maskValue(patient.sampleCode) : "Sin dato"}`,
        `Diagnóstico: ${patient.diagnosis || "Sin dato"}`,
        `Estudio: ${patient.geneticStudy || "Sin dato"}`,
        `Antecedentes: ${patient.familyHistory || "Sin dato"}`,
        `Notas clinicas: ${patient.clinicalNotes || "Sin dato"}`,
        `Registro: ${dateFormatter.format(new Date(patient.createdAt))}`,
      ].join(" | "),
      18,
      y,
      178,
    );
    y += 5;
  });

  doc.save(`reporte-pacientes-genética-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function exportPatientTemplate() {
  const templateRows: ExcelRecord[] = [
    {
      Nombre: "Ana",
      Apellidos: "Lopez Perez",
      Edad: 29,
      Sexo: "Femenino",
      Localidad: "Tlalpan",
      Estado: "Ciudad de México",
      Vivienda: "Casa",
      "Material Vivienda": "Concreto",
      Agua: "Agua Entubada",
      Saneamiento: "Drenaje",
      Hacinamiento: "No",
      "Condiciones De Vida": "Servicios básicos completos",
      "Código Muestra": "MUE-2026-000",
      Diagnóstico: "Tamiz Familiar",
      "Estudio Genético": "Panel Hereditario",
      "Antecedentes Familiares": "Sin Reporte",
      Teléfono: "5512345678",
      "Notas Clínicas": "Registro De Ejemplo",
    },
  ];

  await writeXlsxFile([
    {
      data: recordsToSheet(templateRows, Object.keys(templateRows[0])),
      sheet: "Pacientes",
      stickyRowsCount: 1,
    },
  ]).toFile("plantilla-carga-pacientes.xlsx");
}
