import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Bell,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Gauge,
  Dna,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  MEXICO_STATES,
  RECOMMENDED_SUPERUSER_PASSWORD,
  SUPERUSER_EMAIL,
  demoInventoryMovements,
  demoInventoryProducts,
  demoLogs,
  demoPatients,
  demoUsers,
} from "./data/demo";
import { usePersistentState } from "./hooks/usePersistentState";
import { calculateMetrics, filterPatients } from "./lib/analytics";
import { exportDashboardWorkbook, exportPatientTemplate, exportReportPdf, readPatientsFromFile } from "./lib/files";
import { getPatientFullName, makeId, normalizePatientInput, toTitleCase } from "./lib/normalization";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import type {
  ActivityLog,
  AppNotification,
  AppUser,
  ClinicalVariable,
  ClinicalVariableType,
  GeneticRecord,
  GeneticRecordInput,
  ImportPreview,
  InventoryMovement,
  InventoryMovementType,
  InventoryProduct,
  InventoryProductInput,
  Patient,
  PatientInput,
  PopulationType,
  ReportFilters,
  UserRole,
} from "./types";

type TabId = "dashboard" | "patients" | "records" | "import" | "reports" | "users";
type AppModule = "launcher" | "database" | "inventory" | "genetics";
type InventoryTabId = "overview" | "products" | "movements";
type PatientStorageMode = "full" | "customFields" | "legacyNotes";

type ChartVariable = "state" | "sex" | "housingType" | "diagnosis" | "geneticStudy";

type NavigationItem = {
  id: TabId;
  label: string;
  icon: LucideIcon;
  superuserOnly?: boolean;
};

type InventoryNavigationItem = {
  id: InventoryTabId;
  label: string;
  icon: LucideIcon;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: "active" | "disabled";
  color?: string | null;
  created_at: string;
  created_by?: string | null;
};

type PatientRow = {
  id: string;
  population_type?: PopulationType | null;
  first_name: string;
  last_name: string;
  age?: number | null;
  sex?: string | null;
  locality?: string | null;
  state?: string | null;
  birth_place?: string | null;
  father_birth_place?: string | null;
  mother_birth_place?: string | null;
  body_mass_index?: number | null;
  height?: number | null;
  height_unit?: "cm" | "m" | null;
  weight?: number | null;
  symptom_start_year?: number | null;
  comorbidities?: string[] | null;
  neurological_symptoms?: string[] | null;
  education_level?: string | null;
  household_size?: number | null;
  room_count?: number | null;
  floor_type?: string | null;
  housing_type?: string | null;
  housing_material?: string | null;
  water_access?: string | null;
  sanitation?: string | null;
  overcrowding?: boolean | null;
  life_conditions?: string | null;
  sample_code?: string | null;
  diagnosis?: string | null;
  genetic_study?: string | null;
  family_history?: string | null;
  contact_phone?: string | null;
  clinical_notes?: string | null;
  custom_fields?: Record<string, unknown> | null;
  created_by: string;
  created_by_name?: string | null;
  created_by_email?: string | null;
  created_at: string;
  updated_at: string;
};

type GeneticRecordRow = {
  id: string;
  patient_id: string;
  genotyping?: string | null;
  relative_gene_quantification?: string | null;
  soluble_protein_levels?: string | null;
  massive_sequencing?: string | null;
  notes?: string | null;
  created_by: string;
  created_by_name: string;
  created_by_email: string;
  created_at: string;
  updated_at: string;
};

type LogRow = {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_email: string;
  action: string;
  entity_type: ActivityLog["entityType"];
  entity_id?: string | null;
  summary: string;
  created_at: string;
};

type NotificationRow = {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_email: string;
  title: string;
  message: string;
  entity_type: ActivityLog["entityType"];
  entity_id?: string | null;
  read_by?: string[] | null;
  hidden_by?: string[] | null;
  created_at: string;
};

type InventoryProductRow = {
  id: string;
  name: string;
  sku?: string | null;
  category?: string | null;
  unit?: string | null;
  stock: number;
  min_stock: number;
  location?: string | null;
  notes?: string | null;
  created_by: string;
  created_by_name: string;
  created_by_email: string;
  created_at: string;
  updated_at: string;
};

type InventoryMovementRow = {
  id: string;
  product_id: string;
  product_name: string;
  product_sku?: string | null;
  movement_type: InventoryMovementType;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason: string;
  actor_id: string;
  actor_name: string;
  actor_email: string;
  created_at: string;
};

type AppAlert = {
  id: string;
  title: string;
  message: string;
  tone: "info" | "danger";
  confirmText: string;
  cancelText?: string;
  resolve?: (confirmed: boolean) => void;
};

const navigation: NavigationItem[] = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "patients", label: "Población", icon: ClipboardList },
  { id: "records", label: "Registros", icon: Activity },
  { id: "import", label: "Carga", icon: Upload },
  { id: "reports", label: "Reportes", icon: FileText },
  { id: "users", label: "Configuración", icon: Settings, superuserOnly: true },
];

const inventoryNavigation: InventoryNavigationItem[] = [
  { id: "overview", label: "Resumen", icon: Gauge },
  { id: "products", label: "Productos", icon: Boxes },
  { id: "movements", label: "Movimientos", icon: Activity },
];

const emptyPatientForm: PatientInput = {
  populationType: "patient",
  firstName: "",
  lastName: "",
  age: undefined,
  sex: "",
  locality: "",
  state: "",
  birthPlace: "",
  fatherBirthPlace: "",
  motherBirthPlace: "",
  bodyMassIndex: undefined,
  height: undefined,
  heightUnit: "cm",
  weight: undefined,
  symptomStartYear: undefined,
  comorbidities: [],
  neurologicalSymptoms: [],
  educationLevel: "",
  householdSize: undefined,
  roomCount: undefined,
  floorType: "",
  housingType: "",
  housingMaterial: "",
  waterAccess: "",
  sanitation: "",
  overcrowding: false,
  lifeConditions: "",
  sampleCode: "",
  diagnosis: "",
  geneticStudy: "",
  familyHistory: "",
  contactPhone: "",
  clinicalNotes: "",
  customFields: {},
};

const emptyGeneticRecordForm: GeneticRecordInput = {
  patientId: "",
  genotyping: "",
  relativeGeneQuantification: "",
  solubleProteinLevels: "",
  massiveSequencing: "",
  notes: "",
};

const emptyClinicalVariableForm = {
  label: "",
  type: "text" as ClinicalVariableType,
  identifier: "",
};

const comorbidityOptions = [
  "Hipertensión Arterial",
  "Diabetes Mellitus Tipo 1",
  "Diabetes Mellitus Tipo 2",
  "Tabaquismo",
  "Alcoholismo",
  "Asma Bronquial",
  "Obesidad",
  "Síndrome Metabólico",
  "Epilepsia",
  "Enfermedad Cerebrovascular Previa",
  "Sedentarismo",
];

const neurologicalSymptomOptions = [
  "Flacidez",
  "Rigidez",
  "Cefalea",
  "Pérdida Ponderal",
  "Incontinencia",
  "Convulsiones",
  "Disartria",
  "Mioclonus",
  "Paraparesia",
  "Temblor",
  "Incoordinación",
  "Desorientación",
  "Discalculia",
  "Agresividad",
  "Perseverancia",
  "Afasia",
  "Insomnio",
  "Depresión",
  "Ansiedad",
  "Apatía",
  "Preocupación",
  "Labilidad Emocional",
  "Irritabilidad",
  "Delirio",
  "Alucinaciones",
  "Ataques de pánico",
  "Conciencia de la enfermedad",
  "Aislamiento",
  "Amnesia",
  "Trastorno de la marcha",
  "Debilidad Muscular",
  "Mutismo",
  "Espasticidad",
];

const educationLevelOptions = ["Primaria", "Secundaria", "Técnico medio", "Obrero calificado", "Preparatoria", "Licenciatura", "Posgrado"];

const floorTypeOptions = ["Tierra", "Cemento", "Mosaico", "Loseta", "Madera", "Otro"];
const housingMaterialOptions = ["Block", "Concreto", "Lámina", "Adobe", "Madera", "Mixto", "Otro"];

const emptyInventoryProductForm: InventoryProductInput = {
  name: "",
  sku: "",
  category: "",
  unit: "Unidad",
  stock: 0,
  minStock: 0,
  location: "",
  notes: "",
};

const emptyInventoryMovementForm = {
  type: "entrada" as InventoryMovementType,
  quantity: 1,
  reason: "",
};

const emptyFilters: ReportFilters = {
  search: "",
  state: "",
  sex: "",
  from: "",
  to: "",
};

const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

const chartVariableLabels: Record<ChartVariable, string> = {
  state: "Estado",
  sex: "Sexo",
  housingType: "Vivienda",
  diagnosis: "Diagnóstico",
  geneticStudy: "Estudio genético",
};

function rowFormSnapshot(row: PatientRow) {
  if (row.custom_fields && Object.keys(row.custom_fields).length) {
    return row.custom_fields;
  }

  const marker = "DATOS_FORMULARIO=";
  const markerIndex = row.clinical_notes?.indexOf(marker) ?? -1;
  if (markerIndex < 0) {
    return {};
  }

  try {
    return JSON.parse(row.clinical_notes?.slice(markerIndex + marker.length) ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function rowCustomString(row: PatientRow, key: string) {
  const value = rowFormSnapshot(row)[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function rowCustomNumber(row: PatientRow, key: string) {
  const value = rowFormSnapshot(row)[key];
  const numericValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function rowCustomList(row: PatientRow, key: string) {
  const value = rowFormSnapshot(row)[key];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return typeof value === "string" ? value.split("|").filter(Boolean) : [];
}

function rowPopulationType(row: PatientRow) {
  const snapshotType = rowCustomString(row, "populationType");
  return row.population_type ?? (snapshotType === "control" ? "control" : "patient");
}

function mapProfile(row: ProfileRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    status: row.status,
    color: row.color ?? "#0f766e",
    createdAt: row.created_at,
    createdBy: row.created_by ?? undefined,
  };
}

function mapPatient(row: PatientRow): Patient {
  return {
    id: row.id,
    populationType: rowPopulationType(row),
    firstName: row.first_name,
    lastName: row.last_name,
    age: row.age ?? undefined,
    sex: row.sex ?? "",
    locality: row.locality ?? "",
    state: row.state ?? "",
    birthPlace: row.birth_place ?? rowCustomString(row, "birthPlace"),
    fatherBirthPlace: row.father_birth_place ?? rowCustomString(row, "fatherBirthPlace"),
    motherBirthPlace: row.mother_birth_place ?? rowCustomString(row, "motherBirthPlace"),
    bodyMassIndex: row.body_mass_index ?? rowCustomNumber(row, "bodyMassIndex"),
    height: row.height ?? rowCustomNumber(row, "height"),
    heightUnit: row.height_unit ?? "cm",
    weight: row.weight ?? rowCustomNumber(row, "weight"),
    symptomStartYear: row.symptom_start_year ?? rowCustomNumber(row, "symptomStartYear"),
    comorbidities: row.comorbidities ?? rowCustomList(row, "comorbidities"),
    neurologicalSymptoms: row.neurological_symptoms ?? rowCustomList(row, "neurologicalSymptoms"),
    educationLevel: row.education_level ?? rowCustomString(row, "educationLevel"),
    householdSize: row.household_size ?? rowCustomNumber(row, "householdSize"),
    roomCount: row.room_count ?? rowCustomNumber(row, "roomCount"),
    floorType: row.floor_type ?? rowCustomString(row, "floorType"),
    housingType: row.housing_type ?? "",
    housingMaterial: row.housing_material ?? "",
    waterAccess: row.water_access ?? "",
    sanitation: row.sanitation ?? "",
    overcrowding: row.overcrowding ?? false,
    lifeConditions: row.life_conditions ?? "",
    sampleCode: row.sample_code ?? "",
    diagnosis: row.diagnosis ?? "",
    geneticStudy: row.genetic_study ?? "",
    familyHistory: row.family_history ?? "",
    contactPhone: row.contact_phone ?? "",
    clinicalNotes: row.clinical_notes?.split("DATOS_FORMULARIO=")[0].trim() ?? "",
    customFields: rowFormSnapshot(row),
    createdBy: row.created_by,
    createdByName: row.created_by_name ?? "Usuario",
    createdByEmail: row.created_by_email ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGeneticRecord(row: GeneticRecordRow): GeneticRecord {
  return {
    id: row.id,
    patientId: row.patient_id,
    genotyping: row.genotyping ?? "",
    relativeGeneQuantification: row.relative_gene_quantification ?? "",
    solubleProteinLevels: row.soluble_protein_levels ?? "",
    massiveSequencing: row.massive_sequencing ?? "",
    notes: row.notes ?? "",
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdByEmail: row.created_by_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLog(row: LogRow): ActivityLog {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorEmail: row.actor_email,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id ?? undefined,
    summary: row.summary,
    createdAt: row.created_at,
  };
}

function mapNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorEmail: row.actor_email,
    title: row.title,
    message: row.message,
    entityType: row.entity_type,
    entityId: row.entity_id ?? undefined,
    readBy: row.read_by ?? [],
    hiddenBy: row.hidden_by ?? [],
    createdAt: row.created_at,
  };
}

function mapInventoryProduct(row: InventoryProductRow): InventoryProduct {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku ?? "",
    category: row.category ?? "",
    unit: row.unit ?? "Unidad",
    stock: row.stock ?? 0,
    minStock: row.min_stock ?? 0,
    location: row.location ?? "",
    notes: row.notes ?? "",
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdByEmail: row.created_by_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInventoryMovement(row: InventoryMovementRow): InventoryMovement {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    productSku: row.product_sku ?? "",
    type: row.movement_type,
    quantity: row.quantity,
    previousStock: row.previous_stock,
    newStock: row.new_stock,
    reason: row.reason,
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorEmail: row.actor_email,
    createdAt: row.created_at,
  };
}

function mergeNotification(notification: AppNotification, existing: AppNotification[]) {
  return [notification, ...existing.filter((item) => item.id !== notification.id)].sort(
    (first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
  );
}

function withUniqueUser(list: string[], userId: string) {
  return Array.from(new Set([...list, userId]));
}

function patientToInsert(patient: PatientInput, currentUser: AppUser) {
  return {
    population_type: patient.populationType,
    first_name: patient.firstName,
    last_name: patient.lastName,
    age: patient.age ?? null,
    sex: patient.sex || null,
    locality: patient.locality || null,
    state: patient.state || null,
    birth_place: patient.birthPlace || null,
    father_birth_place: patient.fatherBirthPlace || null,
    mother_birth_place: patient.motherBirthPlace || null,
    body_mass_index: patient.bodyMassIndex ?? null,
    height: patient.height ?? null,
    height_unit: patient.heightUnit || null,
    weight: patient.weight ?? null,
    symptom_start_year: patient.symptomStartYear ?? null,
    comorbidities: patient.comorbidities ?? [],
    neurological_symptoms: patient.neurologicalSymptoms ?? [],
    education_level: patient.educationLevel || null,
    household_size: patient.householdSize ?? null,
    room_count: patient.roomCount ?? null,
    floor_type: patient.floorType || null,
    housing_type: patient.housingType || null,
    housing_material: patient.housingMaterial || null,
    water_access: patient.waterAccess || null,
    sanitation: patient.sanitation || null,
    overcrowding: patient.overcrowding ?? false,
    life_conditions: patient.lifeConditions || null,
    sample_code: patient.sampleCode || null,
    diagnosis: patient.diagnosis || null,
    genetic_study: patient.geneticStudy || null,
    family_history: patient.familyHistory || null,
    contact_phone: patient.contactPhone || null,
    clinical_notes: patient.clinicalNotes || null,
    custom_fields: patient.customFields ?? {},
    created_by: currentUser.id,
    created_by_name: currentUser.fullName,
    created_by_email: currentUser.email,
  };
}

function patientToUpdate(patient: PatientInput) {
  return {
    population_type: patient.populationType,
    first_name: patient.firstName,
    last_name: patient.lastName,
    age: patient.age ?? null,
    sex: patient.sex || null,
    locality: patient.locality || null,
    state: patient.state || null,
    birth_place: patient.birthPlace || null,
    father_birth_place: patient.fatherBirthPlace || null,
    mother_birth_place: patient.motherBirthPlace || null,
    body_mass_index: patient.bodyMassIndex ?? null,
    height: patient.height ?? null,
    height_unit: patient.heightUnit || null,
    weight: patient.weight ?? null,
    symptom_start_year: patient.symptomStartYear ?? null,
    comorbidities: patient.comorbidities ?? [],
    neurological_symptoms: patient.neurologicalSymptoms ?? [],
    education_level: patient.educationLevel || null,
    household_size: patient.householdSize ?? null,
    room_count: patient.roomCount ?? null,
    floor_type: patient.floorType || null,
    housing_type: patient.housingType || null,
    housing_material: patient.housingMaterial || null,
    water_access: patient.waterAccess || null,
    sanitation: patient.sanitation || null,
    overcrowding: patient.overcrowding ?? false,
    life_conditions: patient.lifeConditions || null,
    sample_code: patient.sampleCode || null,
    diagnosis: patient.diagnosis || null,
    genetic_study: patient.geneticStudy || null,
    family_history: patient.familyHistory || null,
    contact_phone: patient.contactPhone || null,
    clinical_notes: patient.clinicalNotes || null,
    custom_fields: patient.customFields ?? {},
  };
}

function patientFormSnapshot(patient: PatientInput) {
  return {
    populationType: patient.populationType ?? "patient",
    birthPlace: patient.birthPlace ?? "",
    fatherBirthPlace: patient.fatherBirthPlace ?? "",
    motherBirthPlace: patient.motherBirthPlace ?? "",
    bodyMassIndex: patient.bodyMassIndex ?? null,
    height: patient.height ?? null,
    heightUnit: patient.heightUnit ?? "cm",
    weight: patient.weight ?? null,
    symptomStartYear: patient.symptomStartYear ?? null,
    comorbidities: patient.comorbidities ?? [],
    neurologicalSymptoms: patient.neurologicalSymptoms ?? [],
    educationLevel: patient.educationLevel ?? "",
    householdSize: patient.householdSize ?? null,
    roomCount: patient.roomCount ?? null,
    floorType: patient.floorType ?? "",
    housingType: patient.housingType ?? "",
    housingMaterial: patient.housingMaterial ?? "",
    waterAccess: patient.waterAccess ?? "",
    familyHistory: patient.familyHistory ?? "",
    clinicalNotes: patient.clinicalNotes ?? "",
    customFields: patient.customFields ?? {},
  };
}

function patientToCompatibleInsert(patient: PatientInput, currentUser: AppUser, includeCustomFields = true) {
  return {
    first_name: patient.firstName,
    last_name: patient.lastName,
    age: patient.age ?? null,
    sex: patient.sex || null,
    locality: patient.locality || null,
    state: patient.state || null,
    housing_type: patient.housingType || null,
    housing_material: patient.housingMaterial || null,
    water_access: patient.waterAccess || null,
    sanitation: patient.sanitation || null,
    overcrowding: patient.overcrowding ?? false,
    life_conditions: patient.lifeConditions || null,
    sample_code: patient.sampleCode || null,
    diagnosis: patient.diagnosis || null,
    genetic_study: patient.geneticStudy || null,
    family_history: patient.familyHistory || null,
    contact_phone: patient.contactPhone || null,
    clinical_notes: includeCustomFields ? patient.clinicalNotes || null : clinicalNotesWithSnapshot(patient),
    ...(includeCustomFields ? { custom_fields: patientFormSnapshot(patient) } : {}),
    created_by: currentUser.id,
    created_by_name: currentUser.fullName,
    created_by_email: currentUser.email,
  };
}

function patientToCompatibleUpdate(patient: PatientInput, includeCustomFields = true) {
  return {
    first_name: patient.firstName,
    last_name: patient.lastName,
    age: patient.age ?? null,
    sex: patient.sex || null,
    locality: patient.locality || null,
    state: patient.state || null,
    housing_type: patient.housingType || null,
    housing_material: patient.housingMaterial || null,
    water_access: patient.waterAccess || null,
    sanitation: patient.sanitation || null,
    overcrowding: patient.overcrowding ?? false,
    life_conditions: patient.lifeConditions || null,
    sample_code: patient.sampleCode || null,
    diagnosis: patient.diagnosis || null,
    genetic_study: patient.geneticStudy || null,
    family_history: patient.familyHistory || null,
    contact_phone: patient.contactPhone || null,
    clinical_notes: includeCustomFields ? patient.clinicalNotes || null : clinicalNotesWithSnapshot(patient),
    ...(includeCustomFields ? { custom_fields: patientFormSnapshot(patient) } : {}),
  };
}

function clinicalNotesWithSnapshot(patient: PatientInput) {
  const snapshot = JSON.stringify(patientFormSnapshot(patient));
  return [patient.clinicalNotes, `DATOS_FORMULARIO=${snapshot}`].filter(Boolean).join("\n\n");
}

function geneticRecordToInsert(record: GeneticRecordInput, currentUser: AppUser) {
  return {
    patient_id: record.patientId,
    genotyping: record.genotyping || null,
    relative_gene_quantification: record.relativeGeneQuantification || null,
    soluble_protein_levels: record.solubleProteinLevels || null,
    massive_sequencing: record.massiveSequencing || null,
    notes: record.notes || null,
    created_by: currentUser.id,
    created_by_name: currentUser.fullName,
    created_by_email: currentUser.email,
  };
}

function isMissingSchemaError(message: string) {
  const normalized = message.toLocaleLowerCase("es-MX");
  return (
    normalized.includes("could not find") ||
    normalized.includes("schema cache") ||
    normalized.includes("does not exist") ||
    normalized.includes("no existe")
  );
}

function normalizeGeneticRecordInput(record: GeneticRecordInput): GeneticRecordInput {
  return {
    patientId: record.patientId,
    genotyping: toTitleCase(record.genotyping ?? ""),
    relativeGeneQuantification: record.relativeGeneQuantification?.trim() ?? "",
    solubleProteinLevels: record.solubleProteinLevels?.trim() ?? "",
    massiveSequencing: record.massiveSequencing?.trim() ?? "",
    notes: toTitleCase(record.notes ?? ""),
  };
}

function logToInsert(log: ActivityLog) {
  return {
    actor_id: log.actorId,
    actor_name: log.actorName,
    actor_email: log.actorEmail,
    action: log.action,
    entity_type: log.entityType,
    entity_id: log.entityId ?? null,
    summary: log.summary,
  };
}

function normalizeInventoryProductInput(product: InventoryProductInput): InventoryProductInput {
  return {
    name: toTitleCase(product.name),
    sku: product.sku?.trim().toLocaleUpperCase("es-MX") ?? "",
    category: toTitleCase(product.category ?? ""),
    unit: toTitleCase(product.unit || "Unidad"),
    stock: Math.max(0, Number(product.stock) || 0),
    minStock: Math.max(0, Number(product.minStock) || 0),
    location: toTitleCase(product.location ?? ""),
    notes: toTitleCase(product.notes ?? ""),
  };
}

function inventoryProductToInsert(product: InventoryProductInput, currentUser: AppUser) {
  return {
    name: product.name,
    sku: product.sku || null,
    category: product.category || null,
    unit: product.unit || "Unidad",
    stock: product.stock,
    min_stock: product.minStock,
    location: product.location || null,
    notes: product.notes || null,
    created_by: currentUser.id,
    created_by_name: currentUser.fullName,
    created_by_email: currentUser.email,
  };
}

function inventoryProductToUpdate(product: InventoryProductInput) {
  return {
    name: product.name,
    sku: product.sku || null,
    category: product.category || null,
    unit: product.unit || "Unidad",
    min_stock: product.minStock,
    location: product.location || null,
    notes: product.notes || null,
  };
}

function inventoryMovementToInsert(movement: InventoryMovement) {
  return {
    product_id: movement.productId,
    product_name: movement.productName,
    product_sku: movement.productSku || null,
    movement_type: movement.type,
    quantity: movement.quantity,
    previous_stock: movement.previousStock,
    new_stock: movement.newStock,
    reason: movement.reason,
    actor_id: movement.actorId,
    actor_name: movement.actorName,
    actor_email: movement.actorEmail,
  };
}

function makePassword() {
  const words = ["Gen", "Lab", "Hum", "ADN", "Mx"];
  const bytes = new Uint32Array(4);
  window.crypto?.getRandomValues(bytes);
  const first = words[bytes[0] % words.length];
  const second = words[bytes[1] % words.length];
  return `${first}${second}-${2026 + (bytes[2] % 9)}!${String(bytes[3]).slice(0, 4)}`;
}

function formatDate(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

function getChartValue(patient: Patient, variable: ChartVariable) {
  const values: Record<ChartVariable, string | undefined> = {
    state: patient.state,
    sex: patient.sex,
    housingType: patient.housingType,
    diagnosis: patient.diagnosis,
    geneticStudy: patient.geneticStudy,
  };

  return values[variable] || "Sin Dato";
}

function bucketPatientsByVariable(patients: Patient[], variable: ChartVariable) {
  const counts = patients.reduce<Record<string, number>>((accumulator, patient) => {
    const label = getChartValue(patient, variable);
    accumulator[label] = (accumulator[label] ?? 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts)
    .map(([label, value]) => ({
      label,
      value,
      percent: patients.length ? Math.round((value / patients.length) * 100) : 0,
    }))
    .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label));
}

function calculateInventoryMetrics(products: InventoryProduct[], movements: InventoryMovement[]) {
  const totalStock = products.reduce((sum, product) => sum + product.stock, 0);
  const lowStock = products.filter((product) => product.stock <= product.minStock);
  const recentLimit = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentMovements = movements.filter((movement) => new Date(movement.createdAt).getTime() >= recentLimit).length;
  const categories = products.reduce<Record<string, number>>((accumulator, product) => {
    const category = product.category || "Sin categoría";
    accumulator[category] = (accumulator[category] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    totalProducts: products.length,
    totalStock,
    lowStock: lowStock.length,
    recentMovements,
    byCategory: Object.entries(categories)
      .map(([label, value]) => ({
        label,
        value,
        percent: products.length ? Math.round((value / products.length) * 100) : 0,
      }))
      .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label)),
  };
}

function movementTypeLabel(type: InventoryMovementType) {
  const labels: Record<InventoryMovementType, string> = {
    entrada: "Entrada",
    salida: "Salida",
    ajuste: "Ajuste",
  };

  return labels[type];
}

function populationTypeLabel(type?: PopulationType) {
  return type === "control" ? "Control" : "Paciente";
}

function clinicalVariableTypeLabel(type: ClinicalVariableType) {
  const labels: Record<ClinicalVariableType, string> = {
    text: "Texto",
    number: "Número",
    date: "Fecha",
    boolean: "Sí/No",
    select: "Selección",
  };

  return labels[type];
}

function normalizeIdentifier(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toLocaleUpperCase("es-MX")
    .slice(0, 2);
}

function customString(patient: PatientInput, key: string) {
  const value = (patient as unknown as Record<string, unknown>)[key] ?? patient.customFields?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function customList(patient: PatientInput, key: string) {
  const value = (patient as unknown as Record<string, unknown>)[key] ?? patient.customFields?.[key];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return typeof value === "string" ? value.split("|").filter(Boolean) : [];
}

function setListValue(values: string[], option: string, checked: boolean) {
  const next = checked ? [...values, option] : values.filter((value) => value !== option);
  return Array.from(new Set(next)).join("|");
}

function nextPopulationCode(populationType: PopulationType, diagnosisIdentifier: string, patients: Patient[]) {
  if (populationType === "control") {
    const next = patients.filter((patient) => patient.populationType === "control").length + 1;
    return `C${String(next).padStart(4, "0")}`;
  }

  const identifier = normalizeIdentifier(diagnosisIdentifier).padEnd(2, "X");
  const prefix = `P${identifier}`;
  const sequence =
    patients
      .filter((patient) => patient.populationType !== "control" && (patient.sampleCode ?? "").startsWith(prefix))
      .map((patient) => Number((patient.sampleCode ?? "").slice(prefix.length)))
      .filter(Number.isFinite)
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `${prefix}${String(sequence).padStart(3, "0")}`;
}

function quantile(sortedValues: number[], position: number) {
  if (!sortedValues.length) {
    return 0;
  }

  const index = (sortedValues.length - 1) * position;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const weight = index - lowerIndex;
  return Math.round(sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight);
}

function downloadSvgAsPng(svgId: string, filename: string) {
  const svg = document.getElementById(svgId);
  if (!(svg instanceof SVGSVGElement)) {
    return;
  }

  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  const { width, height } = svg.getBoundingClientRect();

  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * 2));
    canvas.height = Math.max(1, Math.round(height * 2));

    const context = canvas.getContext("2d");
    if (!context) {
      URL.revokeObjectURL(url);
      return;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    const link = document.createElement("a");
    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  image.src = url;
}

function App() {
  const [users, setUsers] = usePersistentState<AppUser[]>("genelab.users", demoUsers);
  const [patients, setPatients] = usePersistentState<Patient[]>("genelab.patients", demoPatients);
  const [clinicalVariables, setClinicalVariables] = usePersistentState<ClinicalVariable[]>("genelab.clinicalVariables", []);
  const [geneticRecords, setGeneticRecords] = usePersistentState<GeneticRecord[]>("genelab.geneticRecords", []);
  const [logs, setLogs] = usePersistentState<ActivityLog[]>("genelab.logs", demoLogs);
  const [notifications, setNotifications] = usePersistentState<AppNotification[]>("genelab.notifications", []);
  const [inventoryProducts, setInventoryProducts] = usePersistentState<InventoryProduct[]>(
    "genelab.inventory.products",
    demoInventoryProducts,
  );
  const [inventoryMovements, setInventoryMovements] = usePersistentState<InventoryMovement[]>(
    "genelab.inventory.movements",
    demoInventoryMovements,
  );
  const [currentUser, setCurrentUser] = usePersistentState<AppUser | null>("genelab.currentUser", null);

  const [activeModule, setActiveModule] = useState<AppModule>("launcher");
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [inventoryTab, setInventoryTab] = useState<InventoryTabId>("overview");
  const [booting, setBooting] = useState(isSupabaseConfigured);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [authForm, setAuthForm] = useState({
    email: SUPERUSER_EMAIL,
    password: RECOMMENDED_SUPERUSER_PASSWORD,
  });
  const [patientForm, setPatientForm] = useState<PatientInput>(emptyPatientForm);
  const [patientStorageMode, setPatientStorageMode] = useState<PatientStorageMode>("full");
  const [clinicalVariableForm, setClinicalVariableForm] = useState(emptyClinicalVariableForm);
  const [geneticRecordForm, setGeneticRecordForm] = useState<GeneticRecordInput>(emptyGeneticRecordForm);
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [recordSearch, setRecordSearch] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryMovementSearch, setInventoryMovementSearch] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [reportFilters, setReportFilters] = useState<ReportFilters>(emptyFilters);
  const [chartVariable, setChartVariable] = useState<ChartVariable>("state");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsAvailable, setNotificationsAvailable] = useState(true);
  const [appAlert, setAppAlert] = useState<AppAlert | null>(null);
  const [inventoryProductForm, setInventoryProductForm] = useState<InventoryProductInput>(emptyInventoryProductForm);
  const [inventoryProductModalOpen, setInventoryProductModalOpen] = useState(false);
  const [editingInventoryProductId, setEditingInventoryProductId] = useState<string | null>(null);
  const [inventoryMovementModal, setInventoryMovementModal] = useState<InventoryProduct | null>(null);
  const [inventoryMovementForm, setInventoryMovementForm] = useState(emptyInventoryMovementForm);
  const [userForm, setUserForm] = useState({
    fullName: "",
    email: "",
    role: "staff" as UserRole,
    color: "#2563eb",
    password: makePassword(),
  });
  const [createdCredential, setCreatedCredential] = useState("");

  const isSuperuser = currentUser?.role === "superuser";
  const metrics = useMemo(() => calculateMetrics(patients), [patients]);
  const filteredPatients = useMemo(
    () => filterPatients(patients, { ...emptyFilters, search: patientSearch }),
    [patientSearch, patients],
  );
  const geneticRecordsByPatient = useMemo(() => {
    return geneticRecords.reduce<Map<string, GeneticRecord[]>>((accumulator, record) => {
      const list = accumulator.get(record.patientId) ?? [];
      list.push(record);
      accumulator.set(record.patientId, list);
      return accumulator;
    }, new Map());
  }, [geneticRecords]);
  const reportPatients = useMemo(() => filterPatients(patients, reportFilters), [patients, reportFilters]);
  const reportMetrics = useMemo(() => calculateMetrics(reportPatients), [reportPatients]);
  const chartBuckets = useMemo(() => bucketPatientsByVariable(patients, chartVariable), [chartVariable, patients]);
  const inventoryMetrics = useMemo(
    () => calculateInventoryMetrics(inventoryProducts, inventoryMovements),
    [inventoryMovements, inventoryProducts],
  );
  const filteredInventoryProducts = useMemo(() => {
    const normalizedQuery = inventorySearch.trim().toLocaleLowerCase("es-MX");

    if (!normalizedQuery) {
      return inventoryProducts;
    }

    return inventoryProducts.filter((product) =>
      [product.name, product.sku, product.category, product.location, product.notes]
        .join(" ")
        .toLocaleLowerCase("es-MX")
        .includes(normalizedQuery),
    );
  }, [inventoryProducts, inventorySearch]);
  const filteredInventoryMovements = useMemo(() => {
    const normalizedQuery = inventoryMovementSearch.trim().toLocaleLowerCase("es-MX");

    if (!normalizedQuery) {
      return inventoryMovements;
    }

    return inventoryMovements.filter((movement) =>
      [
        movement.productName,
        movement.productSku,
        movementTypeLabel(movement.type),
        movement.reason,
        movement.actorName,
        movement.actorEmail,
        formatDate(movement.createdAt),
      ]
        .join(" ")
        .toLocaleLowerCase("es-MX")
        .includes(normalizedQuery),
    );
  }, [inventoryMovementSearch, inventoryMovements]);
  const userColorById = useMemo(
    () => new Map(users.map((user) => [user.id, user.color || "#0f766e"])),
    [users],
  );
  const filteredLogs = useMemo(() => {
    const normalizedQuery = recordSearch.trim().toLocaleLowerCase("es-MX");

    if (!normalizedQuery) {
      return logs;
    }

    return logs.filter((log) =>
      [log.actorName, log.actorEmail, log.action, log.summary, log.entityType, formatDate(log.createdAt)]
        .join(" ")
        .toLocaleLowerCase("es-MX")
        .includes(normalizedQuery),
    );
  }, [logs, recordSearch]);
  const visibleNotifications = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    return notifications
      .filter((notification) => !notification.hiddenBy.includes(currentUser.id))
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
  }, [currentUser, notifications]);
  const unreadNotificationCount = useMemo(() => {
    if (!currentUser) {
      return 0;
    }

    return visibleNotifications.filter((notification) => !notification.readBy.includes(currentUser.id)).length;
  }, [currentUser, visibleNotifications]);
  const stateOptions = useMemo(
    () =>
      Array.from(new Set([...MEXICO_STATES, ...patients.map((patient) => patient.state ?? "").filter(Boolean)])).sort(
        (first, second) => first.localeCompare(second),
      ),
    [patients],
  );
  const sexOptions = useMemo(
    () => Array.from(new Set(["Femenino", "Masculino", "Intersexual", "No Especificado", ...patients.map((patient) => patient.sex ?? "").filter(Boolean)])),
    [patients],
  );
  const diagnosisVariables = useMemo(
    () => clinicalVariables.filter((variable) => normalizeIdentifier(variable.identifier).length === 2),
    [clinicalVariables],
  );

  async function refreshRemoteNotifications() {
    if (!supabase) {
      return false;
    }

    const notificationsResult = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(120);

    if (notificationsResult.error) {
      setNotificationsAvailable(false);
      console.warn("No se pudo cargar la tabla de notificaciónes:", notificationsResult.error.message);
      return false;
    }

    setNotificationsAvailable(true);
    setNotifications((notificationsResult.data as NotificationRow[]).map(mapNotification));
    return true;
  }

  async function detectPatientStorageMode(): Promise<PatientStorageMode> {
    if (!supabase) {
      return "full";
    }

    const fullProbe = await supabase
      .from("patients")
      .select(
        "id,population_type,birth_place,father_birth_place,mother_birth_place,body_mass_index,height,height_unit,weight,symptom_start_year,comorbidities,neurological_symptoms,education_level,household_size,room_count,floor_type,custom_fields",
      )
      .limit(1);

    if (!fullProbe.error) {
      return "full";
    }

    const customFieldsProbe = await supabase.from("patients").select("id,custom_fields").limit(1);
    return customFieldsProbe.error ? "legacyNotes" : "customFields";
  }

  async function loadRemoteData(userId: string, userEmail: string) {
    if (!supabase) {
      return;
    }

    setBooting(true);
    setStatusMessage("");

    const profileResult = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (profileResult.error) {
      setStatusMessage(profileResult.error.message);
      setBooting(false);
      return;
    }

    const profile = profileResult.data as ProfileRow | null;
    const resolvedUser = profile
      ? mapProfile(profile)
      : {
          id: userId,
          email: userEmail,
          fullName: userEmail === SUPERUSER_EMAIL ? "Joel Trincado" : userEmail,
          role: userEmail === SUPERUSER_EMAIL ? ("superuser" as const) : ("staff" as const),
          status: "active" as const,
          color: "#0f766e",
          createdAt: new Date().toISOString(),
        };

    const [profilesResult, patientsResult, logsResult, inventoryProductsResult, inventoryMovementsResult, geneticRecordsResult] = await Promise.all([
      resolvedUser.role === "superuser"
        ? supabase.from("profiles").select("*").order("created_at", { ascending: false })
        : supabase.from("profiles").select("*").eq("id", userId),
      supabase.from("patients").select("*").order("created_at", { ascending: false }),
      supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(250),
      supabase.from("inventory_products").select("*").order("created_at", { ascending: false }),
      supabase.from("inventory_movements").select("*").order("created_at", { ascending: false }).limit(250),
      supabase.from("genetic_records").select("*").order("created_at", { ascending: false }),
    ]);

    if (profilesResult.data) {
      setUsers((profilesResult.data as ProfileRow[]).map(mapProfile));
    }

    if (patientsResult.data) {
      setPatients((patientsResult.data as PatientRow[]).map(mapPatient));
    }

    if (logsResult.data) {
      setLogs((logsResult.data as LogRow[]).map(mapLog));
    }

    if (inventoryProductsResult.data) {
      setInventoryProducts((inventoryProductsResult.data as InventoryProductRow[]).map(mapInventoryProduct));
    }

    if (inventoryMovementsResult.data) {
      setInventoryMovements((inventoryMovementsResult.data as InventoryMovementRow[]).map(mapInventoryMovement));
    }

    if (geneticRecordsResult.data) {
      setGeneticRecords((geneticRecordsResult.data as GeneticRecordRow[]).map(mapGeneticRecord));
    }

    setPatientStorageMode(await detectPatientStorageMode());
    await refreshRemoteNotifications();

    setCurrentUser(resolvedUser);
    setBooting(false);
  }

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      if (!supabase) {
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!isMounted) {
        return;
      }

      if (data.session?.user) {
        await loadRemoteData(data.session.user.id, data.session.user.email ?? "");
      } else {
        setCurrentUser(null);
        setBooting(false);
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const client = supabase;

    if (!client || !currentUser || !notificationsAvailable) {
      return undefined;
    }

    const channel = client
      .channel("genelab-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const incoming = mapNotification(payload.new as NotificationRow);
          setNotifications((existing) => mergeNotification(incoming, existing));
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          setNotificationsAvailable(false);
        }
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, [currentUser, notificationsAvailable, setNotifications]);

  useEffect(() => {
    const client = supabase;

    if (!client || !currentUser) {
      return undefined;
    }

    const channel = client
      .channel("genelab-inventory")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory_products" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id?: string }).id;
            setInventoryProducts((existing) => existing.filter((product) => product.id !== deletedId));
            return;
          }

          const incoming = mapInventoryProduct(payload.new as InventoryProductRow);
          setInventoryProducts((existing) => [incoming, ...existing.filter((product) => product.id !== incoming.id)]);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inventory_movements" },
        (payload) => {
          const incoming = mapInventoryMovement(payload.new as InventoryMovementRow);
          setInventoryMovements((existing) => [incoming, ...existing.filter((movement) => movement.id !== incoming.id)]);
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [currentUser, setInventoryMovements, setInventoryProducts]);

  async function recordLog(
    action: string,
    entityType: ActivityLog["entityType"],
    summary: string,
    entityId?: string,
    actor = currentUser,
  ) {
    if (!actor) {
      return;
    }

    const log: ActivityLog = {
      id: makeId("log"),
      actorId: actor.id,
      actorName: actor.fullName,
      actorEmail: actor.email,
      action,
      entityType,
      entityId,
      summary,
      createdAt: new Date().toISOString(),
    };

    setLogs((existing) => [log, ...existing]);

    if (supabase) {
      await supabase.from("activity_logs").insert(logToInsert(log));
    }
  }

  function showAppAlert(title: string, message: string, tone: AppAlert["tone"] = "info") {
    setAppAlert({
      id: makeId("alert"),
      title,
      message,
      tone,
      confirmText: "Entendido",
    });
  }

  function showAppConfirm(title: string, message: string, confirmText = "Confirmar") {
    return new Promise<boolean>((resolve) => {
      setAppAlert({
        id: makeId("alert"),
        title,
        message,
        tone: "danger",
        confirmText,
        cancelText: "Cancelar",
        resolve,
      });
    });
  }

  function closeAppAlert(confirmed: boolean) {
    appAlert?.resolve?.(confirmed);
    setAppAlert(null);
  }

  async function createPatientNotification(patient: Patient, action: string) {
    if (!currentUser) {
      return;
    }

    if (supabase && notificationsAvailable) {
      await refreshRemoteNotifications();
      return;
    }

    const title = action === "Importo Paciente" ? "Paciente importado" : "Nuevo paciente registrado";
    const verb = action === "Importo Paciente" ? "importo" : "registro";
    const notification: AppNotification = {
      id: makeId("ntf"),
      actorId: currentUser.id,
      actorName: currentUser.fullName,
      actorEmail: currentUser.email,
      title,
      message: `${currentUser.fullName} ${verb} a ${getPatientFullName(patient)} (${patient.state || "Sin Estado"}).`,
      entityType: "patient",
      entityId: patient.id,
      readBy: [],
      hiddenBy: [],
      createdAt: new Date().toISOString(),
    };

    setNotifications((existing) => mergeNotification(notification, existing));
  }

  async function syncNotificationFlags(notification: AppNotification) {
    if (!supabase || !notificationsAvailable) {
      return;
    }

    const { error } = await supabase
      .from("notifications")
      .update({ read_by: notification.readBy, hidden_by: notification.hiddenBy })
      .eq("id", notification.id);

    if (error) {
      setNotificationsAvailable(false);
      console.warn("No se pudo sincronizar la notificación:", error.message);
    }
  }

  async function markNotificationsRead() {
    if (!currentUser) {
      return;
    }

    const updatedNotifications = visibleNotifications
      .filter((notification) => !notification.readBy.includes(currentUser.id))
      .map((notification) => ({
        ...notification,
        readBy: withUniqueUser(notification.readBy, currentUser.id),
      }));

    if (!updatedNotifications.length) {
      return;
    }

    setNotifications((existing) =>
      existing.map((notification) => {
        const updated = updatedNotifications.find((candidate) => candidate.id === notification.id);
        return updated ?? notification;
      }),
    );

    await Promise.all(updatedNotifications.map(syncNotificationFlags));
  }

  function toggleNotifications() {
    const willOpen = !notificationsOpen;
    setNotificationsOpen(willOpen);
    if (willOpen) {
      void markNotificationsRead();
    }
  }

  async function hideNotification(notification: AppNotification) {
    if (!currentUser) {
      return;
    }

    const updated = {
      ...notification,
      hiddenBy: withUniqueUser(notification.hiddenBy, currentUser.id),
      readBy: withUniqueUser(notification.readBy, currentUser.id),
    };

    setNotifications((existing) => existing.map((candidate) => (candidate.id === notification.id ? updated : candidate)));
    await syncNotificationFlags(updated);
  }

  async function clearNotifications() {
    if (!currentUser) {
      return;
    }

    const updatedNotifications = visibleNotifications.map((notification) => ({
      ...notification,
      hiddenBy: withUniqueUser(notification.hiddenBy, currentUser.id),
      readBy: withUniqueUser(notification.readBy, currentUser.id),
    }));

    setNotifications((existing) =>
      existing.map((notification) => {
        const updated = updatedNotifications.find((candidate) => candidate.id === notification.id);
        return updated ?? notification;
      }),
    );

    await Promise.all(updatedNotifications.map(syncNotificationFlags));
    setNotificationsOpen(false);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setAuthError("");

    const email = authForm.email.trim().toLocaleLowerCase("es-MX");
    const password = authForm.password;

    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        setAuthError(error?.message ?? "No se pudo iniciar sesión.");
        setBusy(false);
        return;
      }

      await loadRemoteData(data.user.id, data.user.email ?? email);
      setBusy(false);
      return;
    }

    const matchedUser = users.find(
      (user) =>
        user.email.toLocaleLowerCase("es-MX") === email &&
        user.status === "active" &&
        user.demoPassword === password,
    );

    if (!matchedUser) {
      setAuthError("Correo o contraseña incorrectos.");
      setBusy(false);
      return;
    }

    setCurrentUser(matchedUser);
    await recordLog("Inicio Sesión", "session", "Acceso a plataforma", undefined, matchedUser);
    setBusy(false);
  }

  async function logout() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setCurrentUser(null);
    setActiveModule("launcher");
    setActiveTab("dashboard");
    setInventoryTab("overview");
  }

  async function persistPatient(input: PatientInput, action = "Agrego Paciente") {
    if (!currentUser) {
      throw new Error("No hay usuario activo.");
    }

    const normalized = normalizePatientInput(input);
    if (!normalized.firstName || !normalized.lastName) {
      throw new Error("Nombre y apellidos son obligatorios.");
    }

    if ((normalized.populationType ?? "patient") === "patient" && !normalized.diagnosis) {
      throw new Error("Selecciona un diagnóstico para generar el ID del paciente.");
    }

    if (normalized.contactPhone && !/^\d{10}$/.test(normalized.contactPhone)) {
      throw new Error("El teléfono debe tener 10 digitos.");
    }

    const diagnosisIdentifier =
      normalized.populationType === "patient"
        ? diagnosisVariables.find((variable) => variable.label === normalized.diagnosis)?.identifier ?? ""
        : "";
    const normalizedWithId: PatientInput = {
      ...normalized,
      housingType: normalized.housingType || [normalized.floorType, normalized.housingMaterial].filter(Boolean).join(" / "),
      sampleCode: normalized.sampleCode || nextPopulationCode(normalized.populationType ?? "patient", diagnosisIdentifier, patients),
    };

    const now = new Date().toISOString();
    let savedPatient: Patient;

    if (supabase) {
      const insertPayload =
        patientStorageMode === "full"
          ? patientToInsert(normalizedWithId, currentUser)
          : patientToCompatibleInsert(normalizedWithId, currentUser, patientStorageMode === "customFields");
      let { data, error } = await supabase
        .from("patients")
        .insert(insertPayload as never)
        .select("*")
        .single();

      if (error && isMissingSchemaError(error.message)) {
        setPatientStorageMode("customFields");
        const retry = await supabase
          .from("patients")
          .insert(patientToCompatibleInsert(normalizedWithId, currentUser))
          .select("*")
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error && isMissingSchemaError(error.message)) {
        setPatientStorageMode("legacyNotes");
        const retry = await supabase
          .from("patients")
          .insert(patientToCompatibleInsert(normalizedWithId, currentUser, false))
          .select("*")
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error || !data) {
        throw new Error(error?.message ?? "No se pudo guardar el paciente.");
      }

      savedPatient = {
        ...mapPatient(data as PatientRow),
        populationType: normalizedWithId.populationType,
        customFields: normalizedWithId.customFields,
        sampleCode: normalizedWithId.sampleCode,
      };
    } else {
      savedPatient = {
        ...normalizedWithId,
        id: makeId("pat"),
        createdBy: currentUser.id,
        createdByName: currentUser.fullName,
        createdByEmail: currentUser.email,
        createdAt: now,
        updatedAt: now,
      };
    }

    setPatients((existing) => [savedPatient, ...existing]);
    await recordLog(
      action,
      "patient",
      `${getPatientFullName(savedPatient)} - ${savedPatient.state || "Sin Estado"}`,
      savedPatient.id,
    );
    await createPatientNotification(savedPatient, action);
    return savedPatient;
  }

  async function handlePatientSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatusMessage("");

    try {
      if (editingPatientId) {
        await updatePatient(editingPatientId, patientForm);
      } else {
        await persistPatient(patientForm);
      }
      setPatientForm(emptyPatientForm);
      setEditingPatientId(null);
      setPatientModalOpen(false);
      setStatusMessage(editingPatientId ? "Paciente actualizado." : "Paciente guardado y registro agregado.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "No se pudo guardar el paciente.");
    } finally {
      setBusy(false);
    }
  }

  async function updatePatient(patientId: string, input: PatientInput) {
    const normalized = normalizePatientInput(input);
    const normalizedForUpdate: PatientInput = {
      ...normalized,
      housingType: normalized.housingType || [normalized.floorType, normalized.housingMaterial].filter(Boolean).join(" / "),
    };
    if (!normalized.firstName || !normalized.lastName) {
      throw new Error("Nombre y apellidos son obligatorios.");
    }

    if (normalized.contactPhone && !/^\d{10}$/.test(normalized.contactPhone)) {
      throw new Error("El teléfono debe tener 10 digitos.");
    }

    let updatedPatient: Patient;

    if (supabase) {
      const updatePayload =
        patientStorageMode === "full"
          ? patientToUpdate(normalizedForUpdate)
          : patientToCompatibleUpdate(normalizedForUpdate, patientStorageMode === "customFields");
      let { data, error } = await supabase
        .from("patients")
        .update(updatePayload as never)
        .eq("id", patientId)
        .select("*")
        .single();

      if (error && isMissingSchemaError(error.message)) {
        setPatientStorageMode("customFields");
        const retry = await supabase
          .from("patients")
          .update(patientToCompatibleUpdate(normalizedForUpdate))
          .eq("id", patientId)
          .select("*")
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error && isMissingSchemaError(error.message)) {
        setPatientStorageMode("legacyNotes");
        const retry = await supabase
          .from("patients")
          .update(patientToCompatibleUpdate(normalizedForUpdate, false))
          .eq("id", patientId)
          .select("*")
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error || !data) {
        throw new Error(error?.message ?? "No se pudo actualizar el paciente.");
      }

      updatedPatient = {
        ...mapPatient(data as PatientRow),
        populationType: normalizedForUpdate.populationType,
        customFields: normalizedForUpdate.customFields,
      };
    } else {
      const previous = patients.find((patient) => patient.id === patientId);
      if (!previous) {
        throw new Error("No se encontro el paciente.");
      }

      updatedPatient = {
        ...previous,
        ...normalizedForUpdate,
        updatedAt: new Date().toISOString(),
      };
    }

    setPatients((existing) => existing.map((patient) => (patient.id === patientId ? updatedPatient : patient)));
    await recordLog(
      "Edito Paciente",
      "patient",
      `${getPatientFullName(updatedPatient)} - ${updatedPatient.state || "Sin Estado"}`,
      updatedPatient.id,
    );
  }

  function openPatientEditor(patient: Patient) {
    setEditingPatientId(patient.id);
    setPatientForm({
      populationType: patient.populationType ?? "patient",
      firstName: patient.firstName,
      lastName: patient.lastName,
      age: patient.age,
      sex: patient.sex,
      locality: patient.locality,
      state: patient.state,
      birthPlace: patient.birthPlace,
      fatherBirthPlace: patient.fatherBirthPlace,
      motherBirthPlace: patient.motherBirthPlace,
      bodyMassIndex: patient.bodyMassIndex,
      height: patient.height,
      heightUnit: patient.heightUnit ?? "cm",
      weight: patient.weight,
      symptomStartYear: patient.symptomStartYear,
      comorbidities: patient.comorbidities ?? [],
      neurologicalSymptoms: patient.neurologicalSymptoms ?? [],
      educationLevel: patient.educationLevel,
      householdSize: patient.householdSize,
      roomCount: patient.roomCount,
      floorType: patient.floorType,
      housingType: patient.housingType,
      housingMaterial: patient.housingMaterial,
      waterAccess: patient.waterAccess,
      sanitation: patient.sanitation,
      overcrowding: patient.overcrowding,
      lifeConditions: patient.lifeConditions,
      sampleCode: patient.sampleCode,
      diagnosis: patient.diagnosis,
      geneticStudy: patient.geneticStudy,
      familyHistory: patient.familyHistory,
      contactPhone: patient.contactPhone,
      clinicalNotes: patient.clinicalNotes,
      customFields: patient.customFields ?? {},
    });
    setPatientModalOpen(true);
  }

  async function deletePatient(patient: Patient) {
    if (!isSuperuser) {
      showAppAlert("Sin privilegios", "No tiene privilegios para borrar pacientes.", "danger");
      setStatusMessage("No tiene privilegios para borrar pacientes.");
      return;
    }

    const confirmed = await showAppConfirm(
      "Borrar paciente",
      `Esta acción eliminará a ${getPatientFullName(patient)} de la base de datos.`,
      "Borrar",
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setStatusMessage("");

    try {
      if (supabase) {
        const { error } = await supabase.from("patients").delete().eq("id", patient.id);
        if (error) {
          throw new Error(error.message);
        }
      }

      setPatients((existing) => existing.filter((candidate) => candidate.id !== patient.id));
      await recordLog("Borro Paciente", "patient", `${getPatientFullName(patient)} - ${patient.state || "Sin Estado"}`, patient.id);
      setStatusMessage("Paciente borrado.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "No se pudo borrar el paciente.");
    } finally {
      setBusy(false);
    }
  }

  function updatePatientField<K extends keyof PatientInput>(field: K, value: PatientInput[K]) {
    setPatientForm((existing) => ({ ...existing, [field]: value }));
  }

  function updatePatientCustomField(variableId: string, value: string | number | boolean) {
    const typedFieldMap: Partial<Record<string, keyof PatientInput>> = {
      birthPlace: "birthPlace",
      fatherBirthPlace: "fatherBirthPlace",
      motherBirthPlace: "motherBirthPlace",
      bodyMassIndex: "bodyMassIndex",
      height: "height",
      weight: "weight",
      symptomStartYear: "symptomStartYear",
      comorbidities: "comorbidities",
      neurologicalSymptoms: "neurologicalSymptoms",
      educationLevel: "educationLevel",
      householdSize: "householdSize",
      roomCount: "roomCount",
      floorType: "floorType",
    };
    const typedField = typedFieldMap[variableId];

    setPatientForm((existing) => ({
      ...existing,
      ...(typedField
        ? {
            [typedField]:
              variableId === "comorbidities" || variableId === "neurologicalSymptoms"
                ? String(value).split("|").filter(Boolean)
                : ["bodyMassIndex", "height", "weight", "symptomStartYear", "householdSize", "roomCount"].includes(variableId)
                  ? value === ""
                    ? undefined
                    : Number(value)
                  : value,
          }
        : {}),
      customFields: {
        ...(existing.customFields ?? {}),
        [variableId]: value,
      },
    }));
  }

  function createClinicalVariable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = toTitleCase(clinicalVariableForm.label);
    const identifier = normalizeIdentifier(clinicalVariableForm.identifier);

    if (!label) {
      setStatusMessage("Escribe el nombre de la variable.");
      return;
    }

    if (identifier.length !== 2) {
      setStatusMessage("El identificador debe tener dos letras.");
      return;
    }

    const variable: ClinicalVariable = {
      id: makeId("var"),
      label,
      type: clinicalVariableForm.type,
      identifier,
      createdAt: new Date().toISOString(),
    };

    setClinicalVariables((existing) => [variable, ...existing]);
    setClinicalVariableForm(emptyClinicalVariableForm);
    setStatusMessage("Variable agregada al formulario de población.");
  }

  function deleteClinicalVariable(variableId: string) {
    setClinicalVariables((existing) => existing.filter((variable) => variable.id !== variableId));
    setPatients((existing) =>
      existing.map((patient) => {
        const nextCustomFields = { ...(patient.customFields ?? {}) };
        delete nextCustomFields[variableId];
        return { ...patient, customFields: nextCustomFields };
      }),
    );
    setStatusMessage("Variable retirada del formulario de población.");
  }

  async function handleGeneticRecordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatusMessage("");

    try {
      if (!currentUser) {
        throw new Error("No hay usuario activo.");
      }

      const normalized = normalizeGeneticRecordInput(geneticRecordForm);
      if (!normalized.patientId) {
        throw new Error("Selecciona una persona de la población.");
      }

      const now = new Date().toISOString();
      let savedRecord: GeneticRecord;

      if (supabase) {
        const { data, error } = await supabase
          .from("genetic_records")
          .insert(geneticRecordToInsert(normalized, currentUser))
          .select("*")
          .single();

        if (error && isMissingSchemaError(error.message)) {
          savedRecord = {
            ...normalized,
            id: makeId("gen"),
            createdBy: currentUser.id,
            createdByName: currentUser.fullName,
            createdByEmail: currentUser.email,
            createdAt: now,
            updatedAt: now,
          };
        } else if (error || !data) {
          throw new Error(error?.message ?? "No se pudo guardar el registro genético.");
        } else {
          savedRecord = mapGeneticRecord(data as GeneticRecordRow);
        }
      } else {
        savedRecord = {
          ...normalized,
          id: makeId("gen"),
          createdBy: currentUser.id,
          createdByName: currentUser.fullName,
          createdByEmail: currentUser.email,
          createdAt: now,
          updatedAt: now,
        };
      }

      setGeneticRecords((existing) => [savedRecord, ...existing]);
      const patient = patients.find((candidate) => candidate.id === savedRecord.patientId);
      await recordLog("Agrego Variable Genética", "patient", patient ? getPatientFullName(patient) : "Registro genético", savedRecord.patientId);
      setGeneticRecordForm(emptyGeneticRecordForm);
      setStatusMessage("Variables genéticas guardadas.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "No se pudo guardar el registro genético.");
    } finally {
      setBusy(false);
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setBusy(true);
    setStatusMessage("");

    try {
      const preview = await readPatientsFromFile(file);
      setImportPreview(preview);
      setStatusMessage(`${preview.validRows.length} filas listas para importar.`);
    } catch (error) {
      setImportPreview(null);
      setStatusMessage(error instanceof Error ? error.message : "No se pudo leer el archivo.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  async function commitImport() {
    if (!importPreview) {
      return;
    }

    setBusy(true);
    setStatusMessage("");

    try {
      for (const row of importPreview.validRows) {
        await persistPatient(row.patient, "Importo Paciente");
      }

      await recordLog(
        "Importo Archivo",
        "import",
        `${importPreview.validRows.length} pacientes desde ${importPreview.fileName}`,
      );
      setStatusMessage("Importación terminada.");
      setImportPreview(null);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "No se pudo terminar la importación.");
    } finally {
      setBusy(false);
    }
  }

  function openInventoryProductCreator() {
    setInventoryProductForm(emptyInventoryProductForm);
    setEditingInventoryProductId(null);
    setInventoryProductModalOpen(true);
  }

  function openInventoryProductEditor(product: InventoryProduct) {
    setInventoryProductForm({
      name: product.name,
      sku: product.sku,
      category: product.category,
      unit: product.unit,
      stock: product.stock,
      minStock: product.minStock,
      location: product.location,
      notes: product.notes,
    });
    setEditingInventoryProductId(product.id);
    setInventoryProductModalOpen(true);
  }

  function updateInventoryProductField<K extends keyof InventoryProductInput>(field: K, value: InventoryProductInput[K]) {
    setInventoryProductForm((existing) => ({ ...existing, [field]: value }));
  }

  async function saveInventoryMovement(movement: InventoryMovement) {
    if (supabase) {
      const { data, error } = await supabase
        .from("inventory_movements")
        .insert(inventoryMovementToInsert(movement))
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "No se pudo guardar el movimiento.");
      }

      const savedMovement = mapInventoryMovement(data as InventoryMovementRow);
      setInventoryMovements((existing) => [savedMovement, ...existing.filter((candidate) => candidate.id !== savedMovement.id)]);
      return;
    }

    setInventoryMovements((existing) => [movement, ...existing]);
  }

  async function persistInventoryProduct(input: InventoryProductInput) {
    if (!currentUser) {
      throw new Error("No hay usuario activo.");
    }

    const normalized = normalizeInventoryProductInput(input);
    if (!normalized.name) {
      throw new Error("El nombre del producto es obligatorio.");
    }

    const now = new Date().toISOString();
    let savedProduct: InventoryProduct;

    if (supabase) {
      const { data, error } = await supabase
        .from("inventory_products")
        .insert(inventoryProductToInsert(normalized, currentUser))
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "No se pudo guardar el producto.");
      }

      savedProduct = mapInventoryProduct(data as InventoryProductRow);
    } else {
      savedProduct = {
        ...normalized,
        id: makeId("prd"),
        createdBy: currentUser.id,
        createdByName: currentUser.fullName,
        createdByEmail: currentUser.email,
        createdAt: now,
        updatedAt: now,
      };
    }

    setInventoryProducts((existing) => [savedProduct, ...existing]);

    if (savedProduct.stock > 0) {
      await saveInventoryMovement({
        id: makeId("mov"),
        productId: savedProduct.id,
        productName: savedProduct.name,
        productSku: savedProduct.sku,
        type: "entrada",
        quantity: savedProduct.stock,
        previousStock: 0,
        newStock: savedProduct.stock,
        reason: "Alta Inicial",
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorEmail: currentUser.email,
        createdAt: now,
      });
    }

    return savedProduct;
  }

  async function updateInventoryProduct(productId: string, input: InventoryProductInput) {
    const normalized = normalizeInventoryProductInput(input);
    if (!normalized.name) {
      throw new Error("El nombre del producto es obligatorio.");
    }

    let updatedProduct: InventoryProduct;

    if (supabase) {
      const { data, error } = await supabase
        .from("inventory_products")
        .update(inventoryProductToUpdate(normalized))
        .eq("id", productId)
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "No se pudo actualizar el producto.");
      }

      updatedProduct = mapInventoryProduct(data as InventoryProductRow);
    } else {
      const previous = inventoryProducts.find((product) => product.id === productId);
      if (!previous) {
        throw new Error("No se encontro el producto.");
      }

      updatedProduct = {
        ...previous,
        ...normalized,
        stock: previous.stock,
        updatedAt: new Date().toISOString(),
      };
    }

    setInventoryProducts((existing) => existing.map((product) => (product.id === productId ? updatedProduct : product)));
  }

  async function handleInventoryProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatusMessage("");

    try {
      if (editingInventoryProductId) {
        await updateInventoryProduct(editingInventoryProductId, inventoryProductForm);
      } else {
        await persistInventoryProduct(inventoryProductForm);
      }
      setInventoryProductForm(emptyInventoryProductForm);
      setEditingInventoryProductId(null);
      setInventoryProductModalOpen(false);
      setStatusMessage(editingInventoryProductId ? "Producto actualizado." : "Producto agregado al inventario.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "No se pudo guardar el producto.");
    } finally {
      setBusy(false);
    }
  }

  function openInventoryMovement(product: InventoryProduct, type: InventoryMovementType) {
    setInventoryMovementModal(product);
    setInventoryMovementForm({
      type,
      quantity: type === "ajuste" ? product.stock : 1,
      reason: "",
    });
  }

  async function handleInventoryMovementSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser || !inventoryMovementModal) {
      return;
    }

    const product = inventoryMovementModal;
    const quantity = Math.max(0, Number(inventoryMovementForm.quantity) || 0);
    const reason = toTitleCase(inventoryMovementForm.reason || "Movimiento de almacén");

    if (inventoryMovementForm.type !== "ajuste" && quantity <= 0) {
      showAppAlert("Cantidad inválida", "La cantidad debe ser mayor que cero.", "danger");
      return;
    }

    const previousStock = product.stock;
    const newStock =
      inventoryMovementForm.type === "entrada"
        ? previousStock + quantity
        : inventoryMovementForm.type === "salida"
          ? previousStock - quantity
          : quantity;

    if (newStock < 0) {
      showAppAlert("Stock insuficiente", "No hay existencias suficientes para registrar esa salida.", "danger");
      return;
    }

    setBusy(true);
    setStatusMessage("");

    try {
      let updatedProduct: InventoryProduct = {
        ...product,
        stock: newStock,
        updatedAt: new Date().toISOString(),
      };

      if (supabase) {
        const { data, error } = await supabase
          .from("inventory_products")
          .update({ stock: newStock })
          .eq("id", product.id)
          .select("*")
          .single();

        if (error || !data) {
          throw new Error(error?.message ?? "No se pudo actualizar el stock.");
        }

        updatedProduct = mapInventoryProduct(data as InventoryProductRow);
      }

      setInventoryProducts((existing) =>
        existing.map((candidate) => (candidate.id === product.id ? updatedProduct : candidate)),
      );

      await saveInventoryMovement({
        id: makeId("mov"),
        productId: product.id,
        productName: updatedProduct.name,
        productSku: updatedProduct.sku,
        type: inventoryMovementForm.type,
        quantity,
        previousStock,
        newStock,
        reason,
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorEmail: currentUser.email,
        createdAt: new Date().toISOString(),
      });

      setInventoryMovementModal(null);
      setInventoryMovementForm(emptyInventoryMovementForm);
      setStatusMessage("Movimiento registrado.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "No se pudo registrar el movimiento.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteInventoryProduct(product: InventoryProduct) {
    if (!isSuperuser) {
      showAppAlert("Sin privilegios", "No tiene privilegios para borrar productos.", "danger");
      return;
    }

    const confirmed = await showAppConfirm(
      "Borrar producto",
      `Esta acción eliminará ${product.name} del inventario y su historial asociado.`,
      "Borrar",
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setStatusMessage("");

    try {
      if (supabase) {
        const { error } = await supabase.from("inventory_products").delete().eq("id", product.id);
        if (error) {
          throw new Error(error.message);
        }
      }

      setInventoryProducts((existing) => existing.filter((candidate) => candidate.id !== product.id));
      setInventoryMovements((existing) => existing.filter((movement) => movement.productId !== product.id));
      setStatusMessage("Producto borrado.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "No se pudo borrar el producto.");
    } finally {
      setBusy(false);
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser || !isSuperuser) {
      return;
    }

    setBusy(true);
    setStatusMessage("");
    setCreatedCredential("");

    const fullName = toTitleCase(userForm.fullName);
    const email = userForm.email.trim().toLocaleLowerCase("es-MX");
    const password = userForm.password.trim();

    if (!fullName || !email || !password) {
      setStatusMessage("Nombre, correo y contraseña son obligatorios.");
      setBusy(false);
      return;
    }

    try {
      let createdUser: AppUser;

      if (supabase) {
        const { data, error } = await supabase.functions.invoke<{ profile?: ProfileRow }>("create-user", {
          body: {
            email,
            fullName,
            password,
            role: userForm.role,
            color: userForm.color,
          },
        });

        if (error) {
          throw new Error(error.message);
        }

        if (data?.profile) {
          createdUser = mapProfile(data.profile);
        } else {
          createdUser = {
            id: makeId("usr"),
            email,
            fullName,
            role: userForm.role,
            status: "active",
            color: userForm.color,
            createdAt: new Date().toISOString(),
            createdBy: currentUser.id,
          };
        }
      } else {
        if (users.some((user) => user.email.toLocaleLowerCase("es-MX") === email)) {
          throw new Error("Ese correo ya existe.");
        }

        createdUser = {
          id: makeId("usr"),
          email,
          fullName,
          role: userForm.role,
          status: "active",
          color: userForm.color,
          createdAt: new Date().toISOString(),
          createdBy: currentUser.id,
          demoPassword: password,
        };
      }

      setUsers((existing) => [createdUser, ...existing]);
      await recordLog("Creo Usuario", "user", `${createdUser.fullName} (${createdUser.email})`, createdUser.id);
      setCreatedCredential(`Usuario creado: ${email} / ${password}`);
      setUserForm({ fullName: "", email: "", role: "staff", color: "#2563eb", password: makePassword() });
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "No se pudo crear el usuario.");
    } finally {
      setBusy(false);
    }
  }

  const tabTitle = navigation.find((item) => item.id === activeTab)?.label ?? "Dashboard";
  const inventoryTitle = inventoryNavigation.find((item) => item.id === inventoryTab)?.label ?? "Resumen";

  if (booting) {
    return (
      <main className="boot-screen">
        <section className="boot-state">
          <RefreshCw className="spin" size={28} />
          <h1>Conectando plataforma</h1>
          <p>Estamos verificando la sesión y sincronizando la información.</p>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="login-screen">
        <section className="login-card">
          <div className="brand-lockup">
            <span className="brand-symbol">
              <ShieldCheck size={24} />
            </span>
            <div>
              <strong>GenLab Control</strong>
              <span>Laboratorio de genética humana</span>
            </div>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <div>
              <p className="eyebrow">Acceso privado</p>
              <h1>Iniciar Sesión</h1>
            </div>

            <label>
              Correo
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm((form) => ({ ...form, email: event.target.value }))}
                autoComplete="email"
                required
              />
            </label>

            <label>
              Contraseña
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => setAuthForm((form) => ({ ...form, password: event.target.value }))}
                autoComplete="current-password"
                required
              />
            </label>

            {authError ? (
              <p className="inline-alert danger">
                <AlertCircle size={16} />
                {authError}
              </p>
            ) : null}

            <button className="primary-action" type="submit" disabled={busy}>
              <LockKeyhole size={18} />
              {busy ? "Entrando..." : "Entrar"}
            </button>
          </form>

          {!isSupabaseConfigured ? (
            <div className="credential-note">
              <strong>Superusuario demo</strong>
              <span>{SUPERUSER_EMAIL}</span>
              <span>{RECOMMENDED_SUPERUSER_PASSWORD}</span>
            </div>
          ) : null}
        </section>

        <aside className="login-visual" aria-label="Resumen del laboratorio">
          <div className="helix-card">
            <svg className="genetics-emblem" viewBox="0 0 220 220" aria-hidden="true">
              <defs>
                <linearGradient id="dna-stroke" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#0f766e" />
                  <stop offset="52%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#be123c" />
                </linearGradient>
              </defs>
              <path
                d="M64 28 C164 62 164 158 64 192"
                fill="none"
                stroke="url(#dna-stroke)"
                strokeLinecap="round"
                strokeWidth="10"
              />
              <path
                d="M156 28 C56 62 56 158 156 192"
                fill="none"
                stroke="url(#dna-stroke)"
                strokeLinecap="round"
                strokeWidth="10"
                opacity="0.72"
              />
              {[46, 72, 98, 124, 150, 176].map((y, index) => (
                <line
                  key={y}
                  x1={index % 2 ? 73 : 88}
                  x2={index % 2 ? 147 : 132}
                  y1={y}
                  y2={y}
                  stroke="#16202a"
                  strokeLinecap="round"
                  strokeWidth="6"
                  opacity="0.48"
                />
              ))}
            </svg>
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="login-stat-panel">
            <strong>{demoPatients.length}</strong>
            <span>pacientes de muestra</span>
          </div>
        </aside>
      </main>
    );
  }

  if (activeModule === "launcher") {
    return (
      <ModuleLauncher
        currentUser={currentUser}
        notifications={visibleNotifications}
        unreadNotificationCount={unreadNotificationCount}
        notificationsOpen={notificationsOpen}
        onClearNotifications={clearNotifications}
        onDeleteNotification={hideNotification}
        onOpenDatabase={() => {
          setActiveModule("database");
          setActiveTab("dashboard");
        }}
        onOpenGenetics={() => {
          setActiveModule("genetics");
        }}
        onOpenInventory={() => {
          setActiveModule("inventory");
          setInventoryTab("overview");
        }}
        onToggleNotifications={toggleNotifications}
        onLogout={logout}
      />
    );
  }

  if (activeModule === "inventory") {
    return (
      <div className="platform-shell inventory-shell">
        <aside className="sidebar">
          <div className="brand-lockup">
            <span className="brand-symbol">
              <Boxes size={22} />
            </span>
            <div>
              <strong>Inventario</strong>
              <span>Almacén del laboratorio</span>
            </div>
          </div>

          <button className="module-back-button" type="button" onClick={() => setActiveModule("launcher")}>
            <ArrowLeft size={17} />
            Módulos
          </button>

          <nav className="side-nav" aria-label="Navegación de inventario">
            {inventoryNavigation.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={inventoryTab === item.id ? "active" : ""}
                  type="button"
                  onClick={() => setInventoryTab(item.id)}
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="sidebar-user">
            <span>{currentUser.role === "superuser" ? "Superusuario" : "Usuario"}</span>
            <strong>{currentUser.fullName}</strong>
            <small>{currentUser.email}</small>
            <button type="button" onClick={logout}>
              <LogOut size={17} />
              Salir
            </button>
          </div>
        </aside>

        <main className="workspace">
          <header className="topbar">
            <div>
              <h1>{inventoryTitle}</h1>
              <span>{new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <div className="topbar-actions">
              <div className="notification-wrap">
                <button
                  className="notification-button"
                  type="button"
                  aria-label={`Notificaciones: ${unreadNotificationCount} sin leer`}
                  onClick={toggleNotifications}
                >
                  <Bell size={18} />
                  {unreadNotificationCount ? <span className="notification-badge">{unreadNotificationCount}</span> : null}
                </button>
                {notificationsOpen ? (
                  <NotificationPanel
                    notifications={visibleNotifications}
                    onClear={clearNotifications}
                    onDelete={hideNotification}
                  />
                ) : null}
              </div>
              <button type="button" onClick={openInventoryProductCreator}>
                <Plus size={18} />
                Agregar producto
              </button>
            </div>
          </header>

          {statusMessage ? (
            <p className="inline-alert">
              <CheckCircle2 size={16} />
              {statusMessage}
            </p>
          ) : null}

          {inventoryTab === "overview" ? (
            <section className="view-stack">
              <div className="metric-grid">
                <article className="metric-card">
                  <span>Productos</span>
                  <strong>{inventoryMetrics.totalProducts}</strong>
                  <small>registrados en almacén</small>
                </article>
                <article className="metric-card accent-blue">
                  <span>Existencias</span>
                  <strong>{inventoryMetrics.totalStock}</strong>
                  <small>unidades totales</small>
                </article>
                <article className="metric-card accent-amber">
                  <span>Stock bajo</span>
                  <strong>{inventoryMetrics.lowStock}</strong>
                  <small>productos bajo mínimo</small>
                </article>
                <article className="metric-card accent-rose">
                  <span>Movimientos</span>
                  <strong>{inventoryMetrics.recentMovements}</strong>
                  <small>en los últimos 7 días</small>
                </article>
              </div>

              <div className="dashboard-grid">
                <ChartCard title="Productos por categoría" subtitle="Distribución del almacén" icon={BarChart3} svgId="chart-inventory-category">
                  <BarChartSvg buckets={inventoryMetrics.byCategory.slice(0, 8)} svgId="chart-inventory-category" />
                </ChartCard>
                <InventoryRecentPanel
                  products={inventoryProducts.filter((product) => product.stock <= product.minStock).slice(0, 5)}
                  movements={inventoryMovements.slice(0, 5)}
                />
              </div>
            </section>
          ) : null}

          {inventoryTab === "products" ? (
            <section className="data-panel">
              <div className="panel-title">
                <div>
                  <p className="eyebrow">Almacén</p>
                  <h2>Productos</h2>
                </div>
                <label className="search-box">
                  <Search size={17} />
                  <input value={inventorySearch} onChange={(event) => setInventorySearch(event.target.value)} placeholder="Buscar producto" />
                </label>
              </div>
              <InventoryProductTable
                products={filteredInventoryProducts}
                onDelete={deleteInventoryProduct}
                onEdit={openInventoryProductEditor}
                onMove={openInventoryMovement}
              />
            </section>
          ) : null}

          {inventoryTab === "movements" ? (
            <section className="data-panel">
              <div className="panel-title">
                <div>
                  <p className="eyebrow">Bitacora</p>
                  <h2>Movimientos de almacén</h2>
                </div>
                <label className="search-box">
                  <Search size={17} />
                  <input
                    value={inventoryMovementSearch}
                    onChange={(event) => setInventoryMovementSearch(event.target.value)}
                    placeholder="Buscar usuario, producto, motivo"
                  />
                </label>
              </div>
              <span className="count-chip">{filteredInventoryMovements.length} movimientos</span>
              <InventoryMovementTimeline movements={filteredInventoryMovements} userColorById={userColorById} />
            </section>
          ) : null}

          {inventoryProductModalOpen ? (
            <div className="modal-backdrop" role="presentation">
              <section className="patient-modal" role="dialog" aria-modal="true" aria-label="Producto de inventario">
                <div className="panel-title">
                  <div>
                    <p className="eyebrow">Inventario</p>
                    <h2>{editingInventoryProductId ? "Editar producto" : "Nuevo producto"}</h2>
                  </div>
                  <button className="icon-action" type="button" aria-label="Cerrar" onClick={() => setInventoryProductModalOpen(false)}>
                    <X size={20} />
                  </button>
                </div>
                <InventoryProductForm
                  busy={busy}
                  editing={Boolean(editingInventoryProductId)}
                  productForm={inventoryProductForm}
                  onCancel={() => {
                    setInventoryProductForm(emptyInventoryProductForm);
                    setEditingInventoryProductId(null);
                    setInventoryProductModalOpen(false);
                  }}
                  onFieldChange={updateInventoryProductField}
                  onSubmit={handleInventoryProductSubmit}
                />
              </section>
            </div>
          ) : null}

          {inventoryMovementModal ? (
            <div className="modal-backdrop" role="presentation">
              <section className="movement-modal" role="dialog" aria-modal="true" aria-label="Movimiento de inventario">
                <div className="panel-title">
                  <div>
                    <p className="eyebrow">{movementTypeLabel(inventoryMovementForm.type)}</p>
                    <h2>{inventoryMovementModal.name}</h2>
                  </div>
                  <button className="icon-action" type="button" aria-label="Cerrar" onClick={() => setInventoryMovementModal(null)}>
                    <X size={20} />
                  </button>
                </div>
                <form className="data-form" onSubmit={handleInventoryMovementSubmit}>
                  <div className="form-grid">
                    <label>
                      Tipo
                      <select
                        value={inventoryMovementForm.type}
                        onChange={(event) =>
                          setInventoryMovementForm((form) => ({
                            ...form,
                            type: event.target.value as InventoryMovementType,
                            quantity: event.target.value === "ajuste" ? inventoryMovementModal.stock : form.quantity,
                          }))
                        }
                      >
                        <option value="entrada">Entrada</option>
                        <option value="salida">Salida</option>
                        <option value="ajuste">Ajuste</option>
                      </select>
                    </label>
                    <label>
                      {inventoryMovementForm.type === "ajuste" ? "Existencia final" : "Cantidad"}
                      <input
                        type="number"
                        min="0"
                        value={inventoryMovementForm.quantity}
                        onChange={(event) =>
                          setInventoryMovementForm((form) => ({ ...form, quantity: Number(event.target.value) }))
                        }
                      />
                    </label>
                    <label className="full-field">
                      Motivo
                      <textarea
                        value={inventoryMovementForm.reason}
                        onChange={(event) => setInventoryMovementForm((form) => ({ ...form, reason: event.target.value }))}
                        placeholder="Compra recibida, uso en procesamiento, conteo físico..."
                      />
                    </label>
                  </div>
                  <div className="movement-preview">
                    <span>Stock actual <strong>{inventoryMovementModal.stock}</strong></span>
                    <span>
                      Stock resultante{" "}
                      <strong>
                        {inventoryMovementForm.type === "entrada"
                          ? inventoryMovementModal.stock + (Number(inventoryMovementForm.quantity) || 0)
                          : inventoryMovementForm.type === "salida"
                            ? inventoryMovementModal.stock - (Number(inventoryMovementForm.quantity) || 0)
                            : Number(inventoryMovementForm.quantity) || 0}
                      </strong>
                    </span>
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="ghost-action" onClick={() => setInventoryMovementModal(null)}>
                      Cancelar
                    </button>
                    <button className="primary-action" type="submit" disabled={busy}>
                      <Plus size={18} />
                      Registrar movimiento
                    </button>
                  </div>
                </form>
              </section>
            </div>
          ) : null}

          {appAlert ? <AlertOverlay appAlert={appAlert} onClose={closeAppAlert} /> : null}
        </main>
      </div>
    );
  }

  if (activeModule === "genetics") {
    return (
      <div className="platform-shell genetics-shell">
        <aside className="sidebar">
          <div className="brand-lockup">
            <span className="brand-symbol">
              <Dna size={22} />
            </span>
            <div>
              <strong style={{ fontSize: "13px" }}>Variables Genéticas</strong>
            </div>
          </div>

          <button className="module-back-button" type="button" onClick={() => setActiveModule("launcher")}>
            <ArrowLeft size={17} />
            Módulos
          </button>

          <nav className="side-nav" aria-label="Navegación de variables genéticas">
            <button className="active" type="button">
              <Dna size={19} />
              <span>Captura genética</span>
            </button>
          </nav>

          <div className="sidebar-user">
            <span>{currentUser.role === "superuser" ? "Superusuario" : "Usuario"}</span>
            <strong>{currentUser.fullName}</strong>
            <small>{currentUser.email}</small>
            <button type="button" onClick={logout}>
              <LogOut size={17} />
              Salir
            </button>
          </div>
        </aside>

        <main className="workspace">
          <header className="topbar">
            <div>
              <h1 style={{ fontSize: "25px" }}>Variables Genéticas</h1>
              <span>{new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <div className="topbar-actions">
              <button type="button" onClick={() => setActiveModule("database")}>
                <ClipboardList size={18} />
                Población
              </button>
            </div>
          </header>

          {statusMessage ? (
            <p className="inline-alert">
              <CheckCircle2 size={16} />
              {statusMessage}
            </p>
          ) : null}

          <section className="content-grid">
            <form className="data-panel data-form" onSubmit={handleGeneticRecordSubmit}>
              <div className="panel-title">
                <div>
                  <p className="eyebrow">Dependiente de población</p>
                  <h2>Captura molecular</h2>
                </div>
                <Dna size={21} />
              </div>
              <div className="form-grid">
                <label className="full-field">
                  Persona registrada
                  <select
                    value={geneticRecordForm.patientId}
                    onChange={(event) => setGeneticRecordForm((form) => ({ ...form, patientId: event.target.value }))}
                    required
                  >
                    <option value="">Seleccionar</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {getPatientFullName(patient)} - {populationTypeLabel(patient.populationType)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="full-field">
                  Genotipificación
                  <textarea value={geneticRecordForm.genotyping} onChange={(event) => setGeneticRecordForm((form) => ({ ...form, genotyping: event.target.value }))} />
                </label>
                <label className="full-field">
                  Cuantificación relativa del gen
                  <textarea
                    value={geneticRecordForm.relativeGeneQuantification}
                    onChange={(event) => setGeneticRecordForm((form) => ({ ...form, relativeGeneQuantification: event.target.value }))}
                  />
                </label>
                <label className="full-field">
                  Niveles solubles de la proteína
                  <textarea
                    value={geneticRecordForm.solubleProteinLevels}
                    onChange={(event) => setGeneticRecordForm((form) => ({ ...form, solubleProteinLevels: event.target.value }))}
                  />
                </label>
                <label className="full-field">
                  Secuenciación masiva
                  <textarea
                    value={geneticRecordForm.massiveSequencing}
                    onChange={(event) => setGeneticRecordForm((form) => ({ ...form, massiveSequencing: event.target.value }))}
                  />
                </label>
                <label className="full-field">
                  Notas
                  <textarea value={geneticRecordForm.notes} onChange={(event) => setGeneticRecordForm((form) => ({ ...form, notes: event.target.value }))} />
                </label>
              </div>
              <button className="primary-action" type="submit" disabled={busy || !patients.length}>
                <Plus size={18} />
                Guardar variables genéticas
              </button>
            </form>

            <GeneticRecordPanel records={geneticRecords} patients={patients} recordsByPatient={geneticRecordsByPatient} />
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="platform-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="brand-symbol">
            <Database size={22} />
          </span>
          <div>
            <strong style={{ fontSize: "13px" }}>Variables Clínico-Demográficas</strong>
          </div>
        </div>

        <button className="module-back-button" type="button" onClick={() => setActiveModule("launcher")}>
          <ArrowLeft size={17} />
          Módulos
        </button>

        <nav className="side-nav" aria-label="Navegación principal">
          {navigation
            .filter((item) => !item.superuserOnly || isSuperuser)
            .map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={activeTab === item.id ? "active" : ""}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                </button>
              );
            })}
        </nav>

        <div className="sidebar-user">
          <span>{currentUser.role === "superuser" ? "Superusuario" : "Usuario"}</span>
          <strong>{currentUser.fullName}</strong>
          <small>{currentUser.email}</small>
          <button type="button" onClick={logout}>
            <LogOut size={17} />
            Salir
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <h1 style={{ fontSize: "25px" }}>{tabTitle}</h1>
            <span>{new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
          </div>
          <div className="topbar-actions">
            <div className="notification-wrap">
              <button
                className="notification-button"
                type="button"
                aria-label={`Notificaciones: ${unreadNotificationCount} sin leer`}
                onClick={toggleNotifications}
              >
                <Bell size={18} />
                {unreadNotificationCount ? <span className="notification-badge">{unreadNotificationCount}</span> : null}
              </button>
              {notificationsOpen ? (
                <NotificationPanel
                  notifications={visibleNotifications}
                  onClear={clearNotifications}
                  onDelete={hideNotification}
                />
              ) : null}
            </div>
            {activeTab === "patients" ? (
              <button
                type="button"
                onClick={() => {
                  setPatientForm(emptyPatientForm);
                  setEditingPatientId(null);
                  setPatientModalOpen(true);
                }}
              >
                <Plus size={18} />
                Agregar población
              </button>
            ) : (
              <button type="button" onClick={() => exportDashboardWorkbook(patients, logs)}>
                <FileSpreadsheet size={18} />
                Excel dashboard
              </button>
            )}
          </div>
        </header>

        {statusMessage ? (
          <p className="inline-alert">
            <CheckCircle2 size={16} />
            {statusMessage}
          </p>
        ) : null}

        {activeTab === "dashboard" ? (
          <section className="view-stack">
            <div className="metric-grid">
              <article className="metric-card">
                <span>Pacientes</span>
                <strong>{metrics.totalPatients}</strong>
                <small>{metrics.recentPatients} en los últimos 7 días</small>
              </article>
              <article className="metric-card accent-blue">
                <span>Edad promedio</span>
                <strong>{metrics.averageAge || "N/D"}</strong>
                <small>Mediana {metrics.medianAge || "N/D"}</small>
              </article>
              <article className="metric-card accent-amber">
                <span>Rango de edad</span>
                <strong>{metrics.minAge || 0}-{metrics.maxAge || 0}</strong>
                <small>Mínima y máxima registradas</small>
              </article>
              <article className="metric-card accent-rose">
                <span>Vivienda</span>
                <strong>{metrics.housingCompleteness}%</strong>
                <small>registros con datos sociales</small>
              </article>
            </div>

            <section className="data-panel chart-toolbar">
              <div>
                <p className="eyebrow">Gráficos</p>
                <h2>Variables del dashboard</h2>
              </div>
              <label>
                Variable
                <select value={chartVariable} onChange={(event) => setChartVariable(event.target.value as ChartVariable)}>
                  {(Object.keys(chartVariableLabels) as ChartVariable[]).map((variable) => (
                    <option key={variable} value={variable}>
                      {chartVariableLabels[variable]}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <div className="dashboard-grid">
              <ChartCard
                title={`Barras por ${chartVariableLabels[chartVariable]}`}
                subtitle="Distribución categórica"
                icon={BarChart3}
                svgId="chart-variable-bars"
              >
                <BarChartSvg buckets={chartBuckets.slice(0, 8)} svgId="chart-variable-bars" />
              </ChartCard>
              <ChartCard title="Box plot de edad" subtitle="Mínimo, cuartiles y máximo" icon={Gauge} svgId="chart-age-box">
                <BoxPlotSvg patients={patients} svgId="chart-age-box" />
              </ChartCard>
              <ChartCard title="Plot edad-registro" subtitle="Puntos por registro capturado" icon={Activity} svgId="chart-age-scatter">
                <ScatterPlotSvg patients={patients} svgId="chart-age-scatter" />
              </ChartCard>
              <RecentPanel patients={patients.slice(0, 5)} logs={logs.slice(0, 5)} />
            </div>
          </section>
        ) : null}

        {activeTab === "patients" ? (
          <section className="view-stack">
            <section className="data-panel">
              <div className="panel-title">
                <div>
                  <p className="eyebrow">Variables Clínico-Demográficas</p>
                  <h2>Población</h2>
                </div>
                <label className="search-box">
                  <Search size={17} />
                  <input value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} placeholder="Buscar" />
                </label>
              </div>

              <PatientTable patients={filteredPatients} onDelete={deletePatient} onEdit={openPatientEditor} onView={setViewingPatient} />
            </section>
          </section>
        ) : null}

        {activeTab === "records" ? (
          <section className="data-panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow">Bitacora</p>
                <h2>Registros realizados</h2>
              </div>
              <label className="search-box">
                <Search size={17} />
                <input
                  value={recordSearch}
                  onChange={(event) => setRecordSearch(event.target.value)}
                  placeholder="Buscar usuario, paciente, ciudad"
                />
              </label>
            </div>
            <span className="count-chip">{filteredLogs.length} eventos</span>
            <div className="timeline">
              {filteredLogs.length ? (
                filteredLogs.map((log) => (
                  <article key={log.id}>
                    <span
                      className="timeline-dot"
                      style={{ "--actor-color": userColorById.get(log.actorId) ?? "#0f766e" } as CSSProperties}
                    />
                    <div>
                      <strong>{log.action}</strong>
                      <p>{log.summary}</p>
                      <small>
                        {log.actorName} · {log.actorEmail} · {formatDate(log.createdAt)}
                      </small>
                    </div>
                  </article>
                ))
              ) : (
                <p className="empty-state">No hay registros que coincidan con la búsqueda.</p>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "import" ? (
          <section className="import-layout">
            <div className="data-panel import-panel">
              <div className="panel-title">
                <div>
                  <p className="eyebrow">Carga masiva</p>
                  <h2>Excel o CSV</h2>
                </div>
                <button className="ghost-action" type="button" onClick={exportPatientTemplate}>
                  <Download size={16} />
                  Plantilla
                </button>
              </div>

              <label className="drop-zone">
                <Upload size={26} />
                <strong>Seleccionar archivo</strong>
                <span>.xlsx, .csv o .tsv</span>
                <input type="file" accept=".xlsx,.csv,.tsv" onChange={handleImportFile} />
              </label>

              <div className="field-map">
                <span>Campos necesarios: Nombre y Apellidos.</span>
                <span>La app estandariza texto a formato Capitulado al importar.</span>
              </div>
            </div>

            <div className="data-panel">
              <div className="panel-title">
                <div>
                  <p className="eyebrow">Previsualización</p>
                  <h2>{importPreview?.fileName ?? "Sin archivo"}</h2>
                </div>
                <span className="count-chip">{importPreview?.validRows.length ?? 0} válidas</span>
              </div>

              {importPreview ? (
                <>
                  <div className="import-summary">
                    <span>
                      <CheckCircle2 size={16} />
                      {importPreview.validRows.length} listas
                    </span>
                    <span>
                      <AlertCircle size={16} />
                      {importPreview.errors.length} con error
                    </span>
                  </div>
                  {importPreview.errors.length ? (
                    <div className="error-list">
                      {importPreview.errors.slice(0, 6).map((error) => (
                        <p key={`${error.rowNumber}-${error.message}`}>Fila {error.rowNumber}: {error.message}</p>
                      ))}
                    </div>
                  ) : null}
                  <button className="primary-action" type="button" disabled={busy || importPreview.validRows.length === 0} onClick={commitImport}>
                    <Upload size={18} />
                    Importar pacientes
                  </button>
                </>
              ) : (
                <p className="empty-state">Carga un archivo para revisar las filas antes de guardarlas.</p>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "reports" ? (
          <section className="reports-layout">
            <form className="data-panel data-form" onSubmit={(event) => event.preventDefault()}>
              <div className="panel-title">
                <div>
                  <p className="eyebrow">Reportes</p>
                  <h2>Filtros</h2>
                </div>
                <Filter size={20} />
              </div>
              <div className="form-grid">
                <label className="full-field">
                  Búsqueda
                  <input value={reportFilters.search} onChange={(event) => setReportFilters((filters) => ({ ...filters, search: event.target.value }))} />
                </label>
                <label>
                  Estado
                  <select value={reportFilters.state} onChange={(event) => setReportFilters((filters) => ({ ...filters, state: event.target.value }))}>
                    <option value="">Todos</option>
                    {stateOptions.map((state) => (
                      <option key={state}>{state}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Sexo
                  <select value={reportFilters.sex} onChange={(event) => setReportFilters((filters) => ({ ...filters, sex: event.target.value }))}>
                    <option value="">Todos</option>
                    {sexOptions.map((sex) => (
                      <option key={sex}>{sex}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Desde
                  <input type="date" value={reportFilters.from} onChange={(event) => setReportFilters((filters) => ({ ...filters, from: event.target.value }))} />
                </label>
                <label>
                  Hasta
                  <input type="date" value={reportFilters.to} onChange={(event) => setReportFilters((filters) => ({ ...filters, to: event.target.value }))} />
                </label>
              </div>
              <div className="report-actions">
                <button type="button" className="ghost-action" onClick={() => setReportFilters(emptyFilters)}>
                  Limpiar
                </button>
                <button type="button" className="primary-action" onClick={() => exportReportPdf(reportPatients, reportFilters)}>
                  <FileText size={18} />
                  Descargar PDF
                </button>
              </div>
            </form>

            <div className="data-panel">
              <div className="panel-title">
                <div>
                  <p className="eyebrow">Resultado</p>
                  <h2>{reportPatients.length} pacientes</h2>
                </div>
                <CalendarDays size={20} />
              </div>
              <div className="report-stats">
                <span>Edad promedio <strong>{reportMetrics.averageAge || "N/D"}</strong></span>
                <span>Mediana <strong>{reportMetrics.medianAge || "N/D"}</strong></span>
                <span>Estados <strong>{reportMetrics.byState.length}</strong></span>
              </div>
              <PatientTable patients={reportPatients.slice(0, 8)} compact />
            </div>
          </section>
        ) : null}

        {activeTab === "users" && isSuperuser ? (
          <section className="content-grid narrow">
            <form className="data-panel data-form" onSubmit={createUser}>
              <div className="panel-title">
                <div>
                  <p className="eyebrow">Configuración</p>
                  <h2>Crear cuenta</h2>
                </div>
                <UserPlus size={21} />
              </div>
              <div className="form-grid">
                <label className="full-field">
                  Nombre
                  <input value={userForm.fullName} onChange={(event) => setUserForm((form) => ({ ...form, fullName: event.target.value }))} required />
                </label>
                <label className="full-field">
                  Correo
                  <input type="email" value={userForm.email} onChange={(event) => setUserForm((form) => ({ ...form, email: event.target.value }))} required />
                </label>
                <label>
                  Rol
                  <select value={userForm.role} onChange={(event) => setUserForm((form) => ({ ...form, role: event.target.value as UserRole }))}>
                    <option value="staff">Usuario</option>
                    <option value="superuser">Superusuario</option>
                  </select>
                </label>
                <label>
                  Color
                  <input type="color" value={userForm.color} onChange={(event) => setUserForm((form) => ({ ...form, color: event.target.value }))} />
                </label>
                <label>
                  Contraseña temporal
                  <input value={userForm.password} onChange={(event) => setUserForm((form) => ({ ...form, password: event.target.value }))} required />
                </label>
              </div>
              <button className="primary-action" type="submit" disabled={busy}>
                <UserPlus size={18} />
                Crear usuario
              </button>
              {createdCredential ? <p className="inline-alert">{createdCredential}</p> : null}
            </form>

            <section className="data-panel">
              <div className="panel-title">
                <div>
                  <p className="eyebrow">Accesos</p>
                  <h2>Accesos</h2>
                </div>
                <span className="count-chip">{users.length}</span>
              </div>
              <div className="user-list">
                {users.map((user) => (
                  <article key={user.id}>
                    <span className="user-color-dot" style={{ background: user.color || "#0f766e" }} />
                    <div>
                      <strong>{user.fullName}</strong>
                      <span>{user.email}</span>
                    </div>
                    <em>{user.role === "superuser" ? "Superusuario" : "Usuario"}</em>
                  </article>
                ))}
              </div>
            </section>

            <form className="data-panel data-form full-width-panel" onSubmit={createClinicalVariable}>
              <div className="panel-title">
                <div>
                  <p className="eyebrow">Diagnósticos configurables</p>
                  <h2>Variables</h2>
                </div>
                <Settings size={21} />
              </div>
              <div className="variable-builder">
                <label>
                  <span>Nombre</span>
                  <input
                    value={clinicalVariableForm.label}
                    onChange={(event) => setClinicalVariableForm((form) => ({ ...form, label: event.target.value }))}
                    placeholder="Ej. Alzheimer"
                  />
                </label>
                <label>
                  <span>Tipo</span>
                  <select
                    value={clinicalVariableForm.type}
                    onChange={(event) =>
                      setClinicalVariableForm((form) => ({ ...form, type: event.target.value as ClinicalVariableType }))
                    }
                  >
                    <option value="text">Texto</option>
                    <option value="number">Número</option>
                    <option value="date">Fecha</option>
                    <option value="boolean">Sí/No</option>
                    <option value="select">Selección</option>
                  </select>
                </label>
                <label>
                  <span>ID</span>
                  <input
                    value={clinicalVariableForm.identifier}
                    onChange={(event) => setClinicalVariableForm((form) => ({ ...form, identifier: normalizeIdentifier(event.target.value) }))}
                    placeholder="Dos letras"
                    maxLength={2}
                  />
                </label>
              </div>
              <button className="primary-action" type="submit">
                <Plus size={18} />
                Agregar variable
              </button>
              <VariableList variables={clinicalVariables} onDelete={deleteClinicalVariable} />
            </form>
          </section>
        ) : null}

        {patientModalOpen ? (
          <div className="modal-backdrop" role="presentation">
            <section className="patient-modal" role="dialog" aria-modal="true" aria-label="Agregar población">
              <div className="panel-title">
                <div>
                  <p className="eyebrow">Población</p>
                  <h2>{editingPatientId ? "Editar registro" : "Nuevo registro"}</h2>
                </div>
                <button className="icon-action" type="button" aria-label="Cerrar" onClick={() => setPatientModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <PatientForm
                busy={busy}
                patientForm={patientForm}
                diagnosisVariables={diagnosisVariables}
                stateOptions={stateOptions}
                onCancel={() => {
                  setPatientForm(emptyPatientForm);
                  setEditingPatientId(null);
                  setPatientModalOpen(false);
                }}
                onFieldChange={updatePatientField}
                onCustomFieldChange={updatePatientCustomField}
                onSubmit={handlePatientSubmit}
              />
            </section>
          </div>
        ) : null}

        {viewingPatient ? (
          <div className="modal-backdrop" role="presentation">
            <section className="patient-modal" role="dialog" aria-modal="true" aria-label="Detalle de población">
              <div className="panel-title">
                <div>
                  <p className="eyebrow">{populationTypeLabel(viewingPatient.populationType)}</p>
                  <h2>{getPatientFullName(viewingPatient)}</h2>
                </div>
                <button className="icon-action" type="button" aria-label="Cerrar" onClick={() => setViewingPatient(null)}>
                  <X size={20} />
                </button>
              </div>
              <PatientDetail patient={viewingPatient} />
            </section>
          </div>
        ) : null}

        {appAlert ? (
          <div className="alert-backdrop" role="presentation">
            <section className={`app-alert ${appAlert.tone}`} role="alertdialog" aria-modal="true" aria-label={appAlert.title}>
              <span className="alert-icon">
                {appAlert.tone === "danger" ? <AlertCircle size={28} /> : <CheckCircle2 size={28} />}
              </span>
              <div>
                <h2>{appAlert.title}</h2>
                <p>{appAlert.message}</p>
              </div>
              <div className="alert-actions">
                {appAlert.cancelText ? (
                  <button type="button" className="ghost-action" onClick={() => closeAppAlert(false)}>
                    {appAlert.cancelText}
                  </button>
                ) : null}
                <button type="button" className="primary-action" onClick={() => closeAppAlert(true)}>
                  {appAlert.confirmText}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function ModuleLauncher({
  currentUser,
  notifications,
  unreadNotificationCount,
  notificationsOpen,
  onClearNotifications,
  onDeleteNotification,
  onOpenDatabase,
  onOpenGenetics,
  onOpenInventory,
  onToggleNotifications,
  onLogout,
}: {
  currentUser: AppUser;
  notifications: AppNotification[];
  unreadNotificationCount: number;
  notificationsOpen: boolean;
  onClearNotifications: () => void;
  onDeleteNotification: (notification: AppNotification) => void;
  onOpenDatabase: () => void;
  onOpenGenetics: () => void;
  onOpenInventory: () => void;
  onToggleNotifications: () => void;
  onLogout: () => void;
}) {
  return (
    <main className="module-launcher">
      <header className="module-header">
        <div className="brand-lockup">
          <span className="brand-symbol">
            <ShieldCheck size={22} />
          </span>
          <div>
            <strong>GenLab Control</strong>
            <span>{currentUser.fullName}</span>
          </div>
        </div>
        <div className="module-header-actions">
          <div className="notification-wrap">
            <button
              className="notification-button"
              type="button"
              aria-label={`Notificaciones: ${unreadNotificationCount} sin leer`}
              onClick={onToggleNotifications}
            >
              <Bell size={18} />
              {unreadNotificationCount ? <span className="notification-badge">{unreadNotificationCount}</span> : null}
            </button>
            {notificationsOpen ? (
              <NotificationPanel notifications={notifications} onClear={onClearNotifications} onDelete={onDeleteNotification} />
            ) : null}
          </div>
          <button className="module-logout" type="button" onClick={onLogout}>
            <LogOut size={17} />
            Salir
          </button>
        </div>
      </header>

      <section className="module-app-grid" aria-label="Módulos de la plataforma">
        <button className="module-card database-app" type="button" onClick={onOpenDatabase}>
          <span className="module-app-icon">
            <Database size={34} />
          </span>
          <span>Variables Clínico-Demográficas</span>
        </button>
        <button className="module-card genetics-app" type="button" onClick={onOpenGenetics}>
          <span className="module-app-icon">
            <Dna size={34} />
          </span>
          <span >Variables Genéticas</span>
        </button>
        <button className="module-card inventory-app" type="button" onClick={onOpenInventory}>
          <span className="module-app-icon">
            <Boxes size={34} />
          </span>
          <span>Inventario</span>
        </button>
      </section>
    </main>
  );
}

function AlertOverlay({
  appAlert,
  onClose,
}: {
  appAlert: AppAlert;
  onClose: (confirmed: boolean) => void;
}) {
  return (
    <div className="alert-backdrop" role="presentation">
      <section className={`app-alert ${appAlert.tone}`} role="alertdialog" aria-modal="true" aria-label={appAlert.title}>
        <span className="alert-icon">
          {appAlert.tone === "danger" ? <AlertCircle size={28} /> : <CheckCircle2 size={28} />}
        </span>
        <div>
          <h2>{appAlert.title}</h2>
          <p>{appAlert.message}</p>
        </div>
        <div className="alert-actions">
          {appAlert.cancelText ? (
            <button type="button" className="ghost-action" onClick={() => onClose(false)}>
              {appAlert.cancelText}
            </button>
          ) : null}
          <button type="button" className="primary-action" onClick={() => onClose(true)}>
            {appAlert.confirmText}
          </button>
        </div>
      </section>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  svgId,
  children,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  svgId: string;
  children: ReactNode;
}) {
  return (
    <section className="data-panel chart-panel">
      <div className="panel-title">
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h2>{title}</h2>
        </div>
        <div className="chart-actions">
          <Icon size={20} />
          <button type="button" onClick={() => downloadSvgAsPng(svgId, title.toLocaleLowerCase("es-MX").replace(/\s+/g, "-"))}>
            <Download size={16} />
            Acciónes
          </button>
        </div>
      </div>
      {children}
    </section>
  );
}

function NotificationPanel({
  notifications,
  onClear,
  onDelete,
}: {
  notifications: AppNotification[];
  onClear: () => void;
  onDelete: (notification: AppNotification) => void;
}) {
  return (
    <section className="notification-panel" role="dialog" aria-label="Notificaciones">
      <div className="notification-panel-head">
        <div>
          <strong>Notificaciones</strong>
          <span>{notifications.length ? `${notifications.length} eventos` : "Sin eventos"}</span>
        </div>
        <button type="button" disabled={!notifications.length} onClick={onClear}>
          Vaciar
        </button>
      </div>
      <div className="notification-list">
        {notifications.length ? (
          notifications.slice(0, 12).map((notification) => (
            <article key={notification.id}>
              <div>
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
                <small>
                  {notification.actorEmail} - {formatDate(notification.createdAt)}
                </small>
              </div>
              <button type="button" aria-label="Eliminar notificación" onClick={() => onDelete(notification)}>
                <Trash2 size={15} />
              </button>
            </article>
          ))
        ) : (
          <p className="empty-state">No hay notificaciónes pendientes.</p>
        )}
      </div>
    </section>
  );
}

function BarChartSvg({
  buckets,
  svgId,
}: {
  buckets: { label: string; value: number; percent: number }[];
  svgId: string;
}) {
  const width = 720;
  const height = 320;
  const max = Math.max(...buckets.map((bucket) => bucket.value), 1);
  const top = 44;
  const rowHeight = 30;

  return (
    <svg id={svgId} className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de barras">
      <rect width={width} height={height} rx="8" fill="#ffffff" />
      <line x1="142" y1="28" x2="142" y2="292" stroke="#d8e2ea" />
      {buckets.length ? (
        buckets.map((bucket, index) => {
          const y = top + index * rowHeight;
          const barWidth = Math.max(8, (bucket.value / max) * 492);
          return (
            <g key={bucket.label}>
              <text x="18" y={y + 15} fill="#526373" fontSize="13">
                {bucket.label.length > 18 ? `${bucket.label.slice(0, 18)}...` : bucket.label}
              </text>
              <rect x="152" y={y} width={barWidth} height="18" rx="6" fill="#0f766e" opacity="0.88" />
              <text x={160 + barWidth} y={y + 14} fill="#16202a" fontSize="13">
                {bucket.value} ({bucket.percent}%)
              </text>
            </g>
          );
        })
      ) : (
        <text x="280" y="162" fill="#718191" fontSize="16">
          Sin datos
        </text>
      )}
    </svg>
  );
}

function BoxPlotSvg({ patients, svgId }: { patients: Patient[]; svgId: string }) {
  const ages = patients
    .map((patient) => patient.age)
    .filter((age): age is number => typeof age === "number")
    .sort((first, second) => first - second);
  const width = 720;
  const height = 320;
  const min = ages[0] ?? 0;
  const max = ages[ages.length - 1] ?? 0;
  const q1 = quantile(ages, 0.25);
  const median = quantile(ages, 0.5);
  const q3 = quantile(ages, 0.75);
  const left = 82;
  const chartWidth = 560;
  const scale = (value: number) => left + ((value - min) / Math.max(max - min, 1)) * chartWidth;

  return (
    <svg id={svgId} className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Box plot de edad">
      <rect width={width} height={height} rx="8" fill="#ffffff" />
      {ages.length ? (
        <>
          <text x="28" y="42" fill="#526373" fontSize="13">
            Edad
          </text>
          <line x1={left} y1="164" x2={left + chartWidth} y2="164" stroke="#d8e2ea" strokeWidth="2" />
          <line x1={scale(min)} y1="134" x2={scale(min)} y2="194" stroke="#2563eb" strokeWidth="3" />
          <line x1={scale(max)} y1="134" x2={scale(max)} y2="194" stroke="#2563eb" strokeWidth="3" />
          <line x1={scale(min)} y1="164" x2={scale(q1)} y2="164" stroke="#2563eb" strokeWidth="3" />
          <line x1={scale(q3)} y1="164" x2={scale(max)} y2="164" stroke="#2563eb" strokeWidth="3" />
          <rect x={scale(q1)} y="120" width={Math.max(8, scale(q3) - scale(q1))} height="88" rx="8" fill="#d9ebe8" stroke="#0f766e" strokeWidth="2" />
          <line x1={scale(median)} y1="116" x2={scale(median)} y2="212" stroke="#be123c" strokeWidth="4" />
          {[
            ["Min", min],
            ["Q1", q1],
            ["Mediana", median],
            ["Q3", q3],
            ["Max", max],
          ].map(([label, value]) => (
            <g key={label}>
              <text x={scale(Number(value)) - 18} y="244" fill="#526373" fontSize="12">
                {label}
              </text>
              <text x={scale(Number(value)) - 8} y="263" fill="#16202a" fontSize="13">
                {value}
              </text>
            </g>
          ))}
        </>
      ) : (
        <text x="280" y="162" fill="#718191" fontSize="16">
          Sin edades registradas
        </text>
      )}
    </svg>
  );
}

function ScatterPlotSvg({ patients, svgId }: { patients: Patient[]; svgId: string }) {
  const points = patients
    .filter((patient) => typeof patient.age === "number")
    .sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime());
  const width = 720;
  const height = 320;
  const left = 62;
  const top = 34;
  const chartWidth = 590;
  const chartHeight = 226;
  const ages = points.map((patient) => patient.age ?? 0);
  const minAge = Math.min(...ages, 0);
  const maxAge = Math.max(...ages, 1);

  return (
    <svg id={svgId} className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Plot de edad por registro">
      <rect width={width} height={height} rx="8" fill="#ffffff" />
      <line x1={left} y1={top} x2={left} y2={top + chartHeight} stroke="#d8e2ea" />
      <line x1={left} y1={top + chartHeight} x2={left + chartWidth} y2={top + chartHeight} stroke="#d8e2ea" />
      <text x="20" y="38" fill="#526373" fontSize="12">
        Edad
      </text>
      <text x="590" y="292" fill="#526373" fontSize="12">
        Registro
      </text>
      {points.length ? (
        points.map((patient, index) => {
          const x = left + (index / Math.max(points.length - 1, 1)) * chartWidth;
          const y = top + chartHeight - (((patient.age ?? 0) - minAge) / Math.max(maxAge - minAge, 1)) * chartHeight;
          const cardX = Math.min(x + 14, width - 234);
          const cardY = Math.max(18, Math.min(y - 78, height - 174));
          return (
            <g key={patient.id} className="scatter-point" tabIndex={0}>
              <circle cx={x} cy={y} r="7" fill="#2563eb" opacity="0.82" />
              <circle cx={x} cy={y} r="14" fill="transparent" />
              <foreignObject x={cardX} y={cardY} width="220" height="162" className="scatter-tooltip">
                <div className="scatter-card">
                  <strong>{getPatientFullName(patient)}</strong>
                  <span>Edad: {patient.age ?? "N/D"} años</span>
                  <span>Sexo: {patient.sex || "N/D"}</span>
                  <span>Estado: {patient.state || "N/D"}</span>
                  <span>Localidad: {patient.locality || "N/D"}</span>
                  <span>Vivienda: {patient.housingType || "N/D"}</span>
                  <span>Diagnóstico: {patient.diagnosis || "N/D"}</span>
                  <span>Estudio: {patient.geneticStudy || "N/D"}</span>
                  <small>{patient.createdByName} - {formatDate(patient.createdAt)}</small>
                </div>
              </foreignObject>
            </g>
          );
        })
      ) : (
        <text x="260" y="162" fill="#718191" fontSize="16">
          Sin datos para graficar
        </text>
      )}
    </svg>
  );
}

function PatientForm({
  busy,
  patientForm,
  diagnosisVariables,
  stateOptions,
  onCancel,
  onFieldChange,
  onCustomFieldChange,
  onSubmit,
}: {
  busy: boolean;
  patientForm: PatientInput;
  diagnosisVariables: ClinicalVariable[];
  stateOptions: string[];
  onCancel: () => void;
  onFieldChange: <K extends keyof PatientInput>(field: K, value: PatientInput[K]) => void;
  onCustomFieldChange: (variableId: string, value: string | number | boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isPatient = patientForm.populationType !== "control";
  const selectedComorbidities = customList(patientForm, "comorbidities");
  const selectedNeurologicalSymptoms = customList(patientForm, "neurologicalSymptoms");

  return (
    <form className="data-form" onSubmit={onSubmit}>
      <section className="form-section">
        <div>
          <p className="eyebrow">Datos personales</p>
          <h3>Identificación</h3>
        </div>
        <div className="form-grid">
        <label className="full-field">
          Tipo de población
          <select value={patientForm.populationType} onChange={(event) => onFieldChange("populationType", event.target.value as PopulationType)}>
            <option value="patient">Paciente</option>
            <option value="control">Control</option>
          </select>
        </label>
        <label>
          Nombre
          <input value={patientForm.firstName} onChange={(event) => onFieldChange("firstName", event.target.value)} required />
        </label>
        <label>
          Apellidos
          <input value={patientForm.lastName} onChange={(event) => onFieldChange("lastName", event.target.value)} required />
        </label>
        <label>
          Estado de residencia
          <select value={patientForm.state} onChange={(event) => onFieldChange("state", event.target.value)}>
            <option value="">Sin dato</option>
            {stateOptions.map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
        </label>
        <label>
          Teléfono
          <input
            inputMode="numeric"
            maxLength={10}
            value={patientForm.contactPhone}
            onChange={(event) => onFieldChange("contactPhone", event.target.value.replace(/\D/g, "").slice(0, 10))}
          />
        </label>
        <label>
          Lugar de nacimiento
          <select value={customString(patientForm, "birthPlace")} onChange={(event) => onCustomFieldChange("birthPlace", event.target.value)}>
            <option value="">Sin dato</option>
            {stateOptions.map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
        </label>
        <label>
          Edad actual
          <input
            type="number"
            min="0"
            value={patientForm.age ?? ""}
            onChange={(event) => onFieldChange("age", event.target.value ? Number(event.target.value) : undefined)}
          />
        </label>
        <label>
          Sexo
          <select value={patientForm.sex} onChange={(event) => onFieldChange("sex", event.target.value)} required>
            <option value="">Sin dato</option>
            <option>Femenino</option>
            <option>Masculino</option>
          </select>
        </label>
        </div>
      </section>

      <section className="form-section">
        <div>
          <p className="eyebrow">Datos sociodemograficos</p>
          <h3>Escolaridad y vivienda</h3>
        </div>
        <div className="form-grid">
        <label>
          Índice de masa corporal
          <input type="number" step="0.01" min="0" value={customString(patientForm, "bodyMassIndex")} onChange={(event) => onCustomFieldChange("bodyMassIndex", event.target.value)} />
        </label>
        <label>
          Talla
          <div className="inline-input-group">
            <input
              type="number"
              step="0.01"
              min="0"
              value={customString(patientForm, "height")}
              onChange={(event) => onCustomFieldChange("height", event.target.value)}
            />
            <select value={patientForm.heightUnit ?? "cm"} onChange={(event) => onFieldChange("heightUnit", event.target.value as "cm" | "m")}>
              <option value="cm">cm</option>
              <option value="m">m</option>
            </select>
          </div>
        </label>
        <label>
          Peso (kg)
          <input type="number" step="0.01" min="0" value={customString(patientForm, "weight")} onChange={(event) => onCustomFieldChange("weight", event.target.value)} />
        </label>
        <label>
          Nivel de escolaridad
          <select value={customString(patientForm, "educationLevel")} onChange={(event) => onCustomFieldChange("educationLevel", event.target.value)}>
            <option value="">Sin dato</option>
            {educationLevelOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          Personas en la casa
          <input type="number" min="0" value={customString(patientForm, "householdSize")} onChange={(event) => onCustomFieldChange("householdSize", event.target.value)} />
        </label>
        <label>
          Número de habitaciones
          <input type="number" min="0" value={customString(patientForm, "roomCount")} onChange={(event) => onCustomFieldChange("roomCount", event.target.value)} />
        </label>
        <label>
          Tipo de suelo
          <select value={customString(patientForm, "floorType")} onChange={(event) => onCustomFieldChange("floorType", event.target.value)}>
            <option value="">Sin dato</option>
            {floorTypeOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          Material de la vivienda
          <select value={patientForm.housingMaterial} onChange={(event) => onFieldChange("housingMaterial", event.target.value)}>
            <option value="">Sin dato</option>
            {housingMaterialOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="full-field">
          Abastecimiento de agua
          <input value={patientForm.waterAccess} onChange={(event) => onFieldChange("waterAccess", event.target.value)} />
        </label>
        </div>
      </section>

      <section className="form-section">
        <div>
          <p className="eyebrow">Antecedentes patológicos personales</p>
          <h3>Condición clínica</h3>
        </div>
        <div className="form-grid">
          {isPatient ? (
            <>
              <label>
                Diagnóstico
                <select value={patientForm.diagnosis} onChange={(event) => onFieldChange("diagnosis", event.target.value)} required>
                  <option value="">Seleccionar</option>
                  {diagnosisVariables.map((variable) => (
                    <option key={variable.id} value={variable.label}>
                      {variable.label} ({variable.identifier})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Año de inicio de síntomas
                <input
                  type="number"
                  min="1900"
                  value={customString(patientForm, "symptomStartYear")}
                  onChange={(event) => onCustomFieldChange("symptomStartYear", event.target.value)}
                />
              </label>
            </>
          ) : null}
          <fieldset className="selector-field full-field">
            <legend>Comorbilidades</legend>
            <div>
              {comorbidityOptions.map((option) => (
                <label key={option} className="check-row">
                  <input
                    type="checkbox"
                    checked={selectedComorbidities.includes(option)}
                    onChange={(event) => onCustomFieldChange("comorbidities", setListValue(selectedComorbidities, option, event.target.checked))}
                  />
                  {option}
                </label>
              ))}
            </div>
          </fieldset>
          {isPatient ? (
            <fieldset className="selector-field full-field">
              <legend>Síntomas neurológicos</legend>
              <div>
                {neurologicalSymptomOptions.map((option) => (
                  <label key={option} className="check-row">
                    <input
                      type="checkbox"
                      checked={selectedNeurologicalSymptoms.includes(option)}
                      onChange={(event) =>
                        onCustomFieldChange("neurologicalSymptoms", setListValue(selectedNeurologicalSymptoms, option, event.target.checked))
                      }
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </div>
      </section>

      <section className="form-section">
        <div>
          <p className="eyebrow">Antecedentes patológicos familiares</p>
          <h3>Origen familiar</h3>
        </div>
        <div className="form-grid">
          <label>
            Lugar de nacimiento del padre
            <select value={customString(patientForm, "fatherBirthPlace")} onChange={(event) => onCustomFieldChange("fatherBirthPlace", event.target.value)}>
              <option value="">Sin dato</option>
              {stateOptions.map((state) => (
                <option key={state}>{state}</option>
              ))}
            </select>
          </label>
          <label>
            Lugar de nacimiento de la madre
            <select value={customString(patientForm, "motherBirthPlace")} onChange={(event) => onCustomFieldChange("motherBirthPlace", event.target.value)}>
              <option value="">Sin dato</option>
              {stateOptions.map((state) => (
                <option key={state}>{state}</option>
              ))}
            </select>
          </label>
          <label className="full-field">
            Antecedentes familiares
            <textarea value={patientForm.familyHistory} onChange={(event) => onFieldChange("familyHistory", event.target.value)} />
          </label>
        </div>
      </section>

      <div className="modal-actions">
        <button type="button" className="ghost-action" onClick={onCancel}>
          Cancelar
        </button>
        <button className="primary-action" type="submit" disabled={busy}>
          <Plus size={18} />
          Guardar población
        </button>
      </div>
    </form>
  );
}

function VariableList({
  variables,
  onDelete,
}: {
  variables: ClinicalVariable[];
  onDelete: (variableId: string) => void;
}) {
  if (!variables.length) {
    return <p className="empty-state">Aún no hay variables adicionales.</p>;
  }

  return (
    <div className="variable-list">
      {variables.map((variable) => (
        <article key={variable.id}>
          <div>
            <strong>{variable.label}</strong>
            <span>
              {clinicalVariableTypeLabel(variable.type)} - {variable.identifier}
            </span>
          </div>
          <button className="danger-action" type="button" onClick={() => onDelete(variable.id)}>
            <Trash2 size={15} />
            Borrar
          </button>
        </article>
      ))}
    </div>
  );
}

function GeneticRecordPanel({
  records,
  patients,
  recordsByPatient,
}: {
  records: GeneticRecord[];
  patients: Patient[];
  recordsByPatient: Map<string, GeneticRecord[]>;
}) {
  const patientById = new Map(patients.map((patient) => [patient.id, patient]));

  return (
    <section className="data-panel">
      <div className="panel-title">
        <div>
          <p className="eyebrow">Registros vinculados</p>
          <h2>Variables capturadas</h2>
        </div>
        <span className="count-chip">{records.length}</span>
      </div>
      <div className="genetic-summary">
        <span>Población disponible <strong>{patients.length}</strong></span>
        <span>Con datos genéticos <strong>{recordsByPatient.size}</strong></span>
      </div>
      <div className="recent-list">
        {records.length ? (
          records.slice(0, 10).map((record) => {
            const patient = patientById.get(record.patientId);
            return (
              <article key={record.id}>
                <strong>{patient ? getPatientFullName(patient) : "Población no encontrada"}</strong>
                <span>
                  {patient ? populationTypeLabel(patient.populationType) : "Sin tipo"} - {formatDate(record.createdAt)}
                </span>
                <small>{[record.genotyping, record.relativeGeneQuantification, record.solubleProteinLevels, record.massiveSequencing].filter(Boolean).join(" / ") || "Sin detalle"}</small>
              </article>
            );
          })
        ) : (
          <p className="empty-state">Selecciona una persona de Población para capturar sus variables genéticas.</p>
        )}
      </div>
    </section>
  );
}

function PatientDetail({ patient }: { patient: Patient }) {
  const rows = [
    ["ID", patient.sampleCode],
    ["Tipo", populationTypeLabel(patient.populationType)],
    ["Registrado por", patient.createdByName],
    ["Nombre", getPatientFullName(patient)],
    ["Estado de residencia", patient.state],
    ["Teléfono", patient.contactPhone],
    ["Lugar de nacimiento", patient.birthPlace],
    ["Nacimiento del padre", patient.fatherBirthPlace],
    ["Nacimiento de la madre", patient.motherBirthPlace],
    ["Edad", patient.age],
    ["Sexo", patient.sex],
    ["IMC", patient.bodyMassIndex],
    ["Talla", patient.height ? `${patient.height} ${patient.heightUnit ?? "cm"}` : ""],
    ["Peso", patient.weight ? `${patient.weight} kg` : ""],
    ["Diagnóstico", patient.diagnosis],
    ["Año de inicio de síntomas", patient.symptomStartYear],
    ["Comorbilidades", patient.comorbidities?.join(", ")],
    ["Síntomas neurológicos", patient.neurologicalSymptoms?.join(", ")],
    ["Escolaridad", patient.educationLevel],
    ["Personas en casa", patient.householdSize],
    ["Habitaciones", patient.roomCount],
    ["Tipo de suelo", patient.floorType],
    ["Material de vivienda", patient.housingMaterial],
    ["Abastecimiento de agua", patient.waterAccess],
    ["Antecedentes familiares", patient.familyHistory],
    ["Fecha de registro", formatDate(patient.createdAt)],
  ];

  return (
    <div className="detail-grid">
      {rows.map(([label, value]) => (
        <article key={String(label)}>
          <span>{label}</span>
          <strong>{value || "N/D"}</strong>
        </article>
      ))}
    </div>
  );
}

function InventoryProductForm({
  busy,
  editing,
  productForm,
  onCancel,
  onFieldChange,
  onSubmit,
}: {
  busy: boolean;
  editing: boolean;
  productForm: InventoryProductInput;
  onCancel: () => void;
  onFieldChange: <K extends keyof InventoryProductInput>(field: K, value: InventoryProductInput[K]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="data-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <label className="full-field">
          Producto
          <input value={productForm.name} onChange={(event) => onFieldChange("name", event.target.value)} required />
        </label>
        <label>
          SKU / Código
          <input value={productForm.sku ?? ""} onChange={(event) => onFieldChange("sku", event.target.value)} />
        </label>
        <label>
          Categoría
          <input value={productForm.category ?? ""} onChange={(event) => onFieldChange("category", event.target.value)} />
        </label>
        <label>
          Unidad
          <input value={productForm.unit ?? ""} onChange={(event) => onFieldChange("unit", event.target.value)} />
        </label>
        <label>
          Stock mínimo
          <input
            type="number"
            min="0"
            value={productForm.minStock}
            onChange={(event) => onFieldChange("minStock", Number(event.target.value))}
          />
        </label>
        <label>
          Stock inicial
          <input
            type="number"
            min="0"
            value={productForm.stock}
            disabled={editing}
            onChange={(event) => onFieldChange("stock", Number(event.target.value))}
          />
        </label>
        <label>
          Ubicación
          <input value={productForm.location ?? ""} onChange={(event) => onFieldChange("location", event.target.value)} />
        </label>
        <label className="full-field">
          Notas
          <textarea value={productForm.notes ?? ""} onChange={(event) => onFieldChange("notes", event.target.value)} />
        </label>
      </div>
      {editing ? <p className="form-hint">El stock se modifica desde las acciónes Entrada, Salida o Ajuste.</p> : null}
      <div className="modal-actions">
        <button type="button" className="ghost-action" onClick={onCancel}>
          Cancelar
        </button>
        <button className="primary-action" type="submit" disabled={busy}>
          <Plus size={18} />
          Guardar producto
        </button>
      </div>
    </form>
  );
}

function InventoryRecentPanel({
  products,
  movements,
}: {
  products: InventoryProduct[];
  movements: InventoryMovement[];
}) {
  return (
    <section className="data-panel recent-panel">
      <div className="panel-title">
        <div>
          <p className="eyebrow">Almacén</p>
          <h2>Alertas y movimientos</h2>
        </div>
        <Boxes size={20} />
      </div>
      <div className="recent-list">
        {products.length ? (
          products.map((product) => (
            <article key={product.id}>
              <strong>{product.name}</strong>
              <span>
                Stock {product.stock} / mínimo {product.minStock} - {product.location || "Sin ubicación"}
              </span>
            </article>
          ))
        ) : (
          <p className="empty-state">No hay productos bajo mínimo.</p>
        )}
      </div>
      <div className="mini-log">
        {movements.slice(0, 3).map((movement) => (
          <span key={movement.id}>
            {movementTypeLabel(movement.type)}: {movement.productName} ({movement.previousStock} a {movement.newStock})
          </span>
        ))}
      </div>
    </section>
  );
}

function InventoryProductTable({
  products,
  onDelete,
  onEdit,
  onMove,
}: {
  products: InventoryProduct[];
  onDelete: (product: InventoryProduct) => void;
  onEdit: (product: InventoryProduct) => void;
  onMove: (product: InventoryProduct, type: InventoryMovementType) => void;
}) {
  if (!products.length) {
    return <p className="empty-state">No hay productos para mostrar.</p>;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Categoría</th>
            <th>Stock</th>
            <th>Ubicación</th>
            <th>Actualizado</th>
            <th className="actions-column">Acciónes</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>
                <strong>{product.name}</strong>
                <span>{product.sku || "Sin código"}</span>
              </td>
              <td>{product.category || "N/D"}</td>
              <td>
                <span className={`stock-pill ${product.stock <= product.minStock ? "low" : ""}`}>
                  {product.stock} {product.unit || "Unidad"}
                </span>
                <span>Mínimo {product.minStock}</span>
              </td>
              <td>{product.location || "N/D"}</td>
              <td>{formatDate(product.updatedAt)}</td>
              <td className="actions-column">
                <div className="row-actions">
                  <button type="button" onClick={() => onMove(product, "entrada")}>
                    Entrada
                  </button>
                  <button type="button" onClick={() => onMove(product, "salida")}>
                    Salida
                  </button>
                  <button type="button" onClick={() => onMove(product, "ajuste")}>
                    Ajuste
                  </button>
                  <button type="button" onClick={() => onEdit(product)}>
                    <Pencil size={15} />
                    Editar
                  </button>
                  <button className="danger-action" type="button" onClick={() => onDelete(product)}>
                    <Trash2 size={15} />
                    Borrar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InventoryMovementTimeline({
  movements,
  userColorById,
}: {
  movements: InventoryMovement[];
  userColorById: Map<string, string>;
}) {
  if (!movements.length) {
    return <p className="empty-state">No hay movimientos que coincidan con la búsqueda.</p>;
  }

  return (
    <div className="timeline inventory-timeline">
      {movements.map((movement) => (
        <article key={movement.id}>
          <span
            className="timeline-dot"
            style={{ "--actor-color": userColorById.get(movement.actorId) ?? "#0f766e" } as CSSProperties}
          />
          <div>
            <strong>
              {movementTypeLabel(movement.type)} - {movement.productName}
            </strong>
            <p>
              {movement.reason} · {movement.previousStock} a {movement.newStock} ({movement.quantity})
            </p>
            <small>
              {movement.actorName} · {movement.actorEmail} · {formatDate(movement.createdAt)}
            </small>
          </div>
        </article>
      ))}
    </div>
  );
}

function RecentPanel({ patients, logs }: { patients: Patient[]; logs: ActivityLog[] }) {
  return (
    <section className="data-panel recent-panel">
      <div className="panel-title">
        <div>
          <p className="eyebrow">Actividad</p>
          <h2>Reciente</h2>
        </div>
        <Activity size={20} />
      </div>
      <div className="recent-list">
        {patients.map((patient) => (
          <article key={patient.id}>
            <strong>{getPatientFullName(patient)}</strong>
            <span>{patient.state || "Sin Estado"} · {formatDate(patient.createdAt)}</span>
          </article>
        ))}
      </div>
      <div className="mini-log">
        {logs.slice(0, 3).map((log) => (
          <span key={log.id}>{log.action}: {log.summary}</span>
        ))}
      </div>
    </section>
  );
}

function PatientTable({
  patients,
  compact = false,
  onDelete,
  onEdit,
  onView,
}: {
  patients: Patient[];
  compact?: boolean;
  onDelete?: (patient: Patient) => void;
  onEdit?: (patient: Patient) => void;
  onView?: (patient: Patient) => void;
}) {
  if (!patients.length) {
    return <p className="empty-state">No hay pacientes para mostrar.</p>;
  }

  const hasActions = Boolean(onDelete || onEdit || onView);

  return (
    <div className="table-scroll">
      <table className={compact ? "compact-table" : ""}>
        <thead>
          <tr>
            <th>Paciente</th>
            <th>ID</th>
            <th>Tipo</th>
            <th>Edad</th>
            <th>Sexo</th>
            <th>Estado</th>
            <th>Vivienda</th>
            <th>Registro por</th>
            <th>Registro</th>
            {hasActions ? <th className="actions-column">Acciónes</th> : null}
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => (
            <tr key={patient.id} className={patient.populationType === "control" ? "population-control-row" : "population-patient-row"}>
              <td>
                <strong>{getPatientFullName(patient)}</strong>
                <span>{patient.locality || "Sin residencia"}</span>
              </td>
              <td>{patient.sampleCode || "Pendiente"}</td>
              <td>{populationTypeLabel(patient.populationType)}</td>
              <td>{patient.age ?? "N/D"}</td>
              <td>{patient.sex || "N/D"}</td>
              <td>{patient.state || "N/D"}</td>
              <td>{patient.housingMaterial || patient.floorType || "N/D"}</td>
              <td>{patient.createdByName || "N/D"}</td>
              <td>{formatDate(patient.createdAt)}</td>
              {hasActions ? (
                <td className="actions-column">
                  <div className="row-actions">
                    {onView ? (
                      <button type="button" onClick={() => onView(patient)}>
                        <Eye size={15} />
                        Ver
                      </button>
                    ) : null}
                    {onEdit ? (
                      <button type="button" onClick={() => onEdit(patient)}>
                        <Pencil size={15} />
                        Editar
                      </button>
                    ) : null}
                    {onDelete ? (
                      <button className="danger-action" type="button" onClick={() => onDelete(patient)}>
                        <Trash2 size={15} />
                        Borrar
                      </button>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
