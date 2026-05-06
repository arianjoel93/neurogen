import type { ImportCandidate, ImportError, PatientInput } from "../types";

const SMALL_WORDS = new Set(["a", "al", "de", "del", "e", "el", "la", "las", "los", "y"]);

type SpreadsheetPatientField = Exclude<keyof PatientInput, "populationType" | "customFields">;

const FIELD_ALIASES: Record<string, SpreadsheetPatientField> = {
  apellido: "lastName",
  apellidos: "lastName",
  antecedentes: "familyHistory",
  antecedentesfamiliares: "familyHistory",
  agua: "waterAccess",
  accesoagua: "waterAccess",
  accesoaagua: "waterAccess",
  age: "age",
  codigo: "sampleCode",
  codigomuestra: "sampleCode",
  condicion: "lifeConditions",
  condiciones: "lifeConditions",
  condicionesdevida: "lifeConditions",
  diagnostico: "diagnosis",
  drenaje: "sanitation",
  edad: "age",
  estado: "state",
  estudio: "geneticStudy",
  estudiogenetico: "geneticStudy",
  familyhistory: "familyHistory",
  firstname: "firstName",
  genero: "sex",
  geneticstudy: "geneticStudy",
  hacinamiento: "overcrowding",
  housingmaterial: "housingMaterial",
  housingtype: "housingType",
  lastname: "lastName",
  lifeconditions: "lifeConditions",
  localidad: "locality",
  material: "housingMaterial",
  materialvivienda: "housingMaterial",
  municipio: "locality",
  name: "firstName",
  nombre: "firstName",
  nombres: "firstName",
  notas: "clinicalNotes",
  notasclinicas: "clinicalNotes",
  paciente: "firstName",
  phone: "contactPhone",
  saneamiento: "sanitation",
  sanitation: "sanitation",
  samplecode: "sampleCode",
  sex: "sex",
  sexo: "sex",
  state: "state",
  telefono: "contactPhone",
  tipovivienda: "housingType",
  vivienda: "housingType",
  wateraccess: "waterAccess",
};

export function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function toTitleCase(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized = String(value)
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-MX");

  if (!normalized) {
    return "";
  }

  return normalized
    .split(" ")
    .map((word, index) =>
      word
        .split("-")
        .map((part) => {
          if (!part) {
            return part;
          }

          if (index > 0 && SMALL_WORDS.has(part)) {
            return part;
          }

          return part.charAt(0).toLocaleUpperCase("es-MX") + part.slice(1);
        })
        .join("-"),
    )
    .join(" ");
}

export function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .replace(/[^a-z0-9]/g, "");
}

function parseOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const numberValue = Number(String(value).replace(",", "."));
  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.round(numberValue) : undefined;
}

function parseOptionalDecimal(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const numberValue = Number(String(value).replace(",", "."));
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : undefined;
}

function parseOptionalBoolean(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .toLocaleLowerCase("es-MX");

  if (!normalized) {
    return undefined;
  }

  if (["1", "si", "sí", "true", "verdadero", "yes"].includes(normalized)) {
    return true;
  }

  if (["0", "no", "false", "falso"].includes(normalized)) {
    return false;
  }

  return undefined;
}

export function normalizePatientInput(input: PatientInput): PatientInput {
  return {
    populationType: input.populationType ?? "patient",
    firstName: toTitleCase(input.firstName),
    lastName: toTitleCase(input.lastName),
    age: parseOptionalNumber(input.age),
    sex: toTitleCase(input.sex),
    locality: toTitleCase(input.locality),
    state: toTitleCase(input.state),
    birthPlace: toTitleCase(input.birthPlace),
    fatherBirthPlace: toTitleCase(input.fatherBirthPlace),
    motherBirthPlace: toTitleCase(input.motherBirthPlace),
    bodyMassIndex: parseOptionalDecimal(input.bodyMassIndex),
    height: parseOptionalDecimal(input.height),
    heightUnit: input.heightUnit ?? "cm",
    weight: parseOptionalDecimal(input.weight),
    symptomStartYear: parseOptionalNumber(input.symptomStartYear),
    comorbidities: input.comorbidities ?? [],
    neurologicalSymptoms: input.neurologicalSymptoms ?? [],
    educationLevel: toTitleCase(input.educationLevel),
    householdSize: parseOptionalNumber(input.householdSize),
    roomCount: parseOptionalNumber(input.roomCount),
    floorType: toTitleCase(input.floorType),
    housingType: toTitleCase(input.housingType),
    housingMaterial: toTitleCase(input.housingMaterial),
    waterAccess: toTitleCase(input.waterAccess),
    sanitation: toTitleCase(input.sanitation),
    overcrowding: input.overcrowding,
    lifeConditions: toTitleCase(input.lifeConditions),
    sampleCode: String(input.sampleCode ?? "").trim().toLocaleUpperCase("es-MX"),
    diagnosis: toTitleCase(input.diagnosis),
    geneticStudy: toTitleCase(input.geneticStudy),
    familyHistory: toTitleCase(input.familyHistory),
    contactPhone: String(input.contactPhone ?? "").trim(),
    clinicalNotes: toTitleCase(input.clinicalNotes),
    customFields: input.customFields ?? {},
  };
}

export function getPatientFullName(patient: Pick<PatientInput, "firstName" | "lastName">) {
  return `${patient.firstName} ${patient.lastName}`.trim();
}

export function patientSearchText(patient: PatientInput) {
  return [
    patient.firstName,
    patient.lastName,
    patient.age,
    patient.sex,
    patient.locality,
    patient.state,
    patient.birthPlace,
    patient.fatherBirthPlace,
    patient.motherBirthPlace,
    patient.bodyMassIndex,
    patient.height,
    patient.heightUnit,
    patient.weight,
    patient.symptomStartYear,
    patient.comorbidities?.join(" "),
    patient.neurologicalSymptoms?.join(" "),
    patient.educationLevel,
    patient.householdSize,
    patient.roomCount,
    patient.floorType,
    patient.housingType,
    patient.housingMaterial,
    patient.waterAccess,
    patient.sanitation,
    patient.lifeConditions,
    patient.sampleCode,
    patient.diagnosis,
    patient.geneticStudy,
    patient.familyHistory,
    patient.contactPhone,
    patient.clinicalNotes,
    ...Object.values(patient.customFields ?? {}),
  ]
    .filter((value) => value !== undefined && value !== "")
    .join(" ")
    .toLocaleLowerCase("es-MX");
}

export function mapSpreadsheetRows(rows: Record<string, unknown>[]) {
  const validRows: ImportCandidate[] = [];
  const errors: ImportError[] = [];

  rows.forEach((row, index) => {
    const candidate: Partial<PatientInput> = {};

    Object.entries(row).forEach(([rawHeader, value]) => {
      const key = FIELD_ALIASES[normalizeHeader(rawHeader)];
      if (!key) {
        return;
      }

      if (key === "age") {
        candidate.age = parseOptionalNumber(value);
        return;
      }

      if (key === "overcrowding") {
        candidate.overcrowding = parseOptionalBoolean(value);
        return;
      }

      (candidate as Record<string, unknown>)[key] = String(value ?? "");
    });

    const normalized = normalizePatientInput({
      populationType: "patient",
      firstName: candidate.firstName ?? "",
      lastName: candidate.lastName ?? "",
      age: candidate.age,
      sex: candidate.sex,
      locality: candidate.locality,
      state: candidate.state,
      housingType: candidate.housingType,
      housingMaterial: candidate.housingMaterial,
      waterAccess: candidate.waterAccess,
      sanitation: candidate.sanitation,
      overcrowding: candidate.overcrowding,
      lifeConditions: candidate.lifeConditions,
      sampleCode: candidate.sampleCode,
      diagnosis: candidate.diagnosis,
      geneticStudy: candidate.geneticStudy,
      familyHistory: candidate.familyHistory,
      contactPhone: candidate.contactPhone,
      clinicalNotes: candidate.clinicalNotes,
      customFields: {},
    });

    const rowNumber = index + 2;
    if (!normalized.firstName || !normalized.lastName) {
      errors.push({
        rowNumber,
        message: "Faltan Nombre y/o Apellidos.",
      });
      return;
    }

    validRows.push({ rowNumber, patient: normalized });
  });

  return { validRows, errors };
}
