export type UserRole = "superuser" | "staff";

export type UserStatus = "active" | "disabled";

export type PopulationType = "patient" | "control";

export type ClinicalVariableType = "text" | "number" | "date" | "boolean" | "select";

export type ClinicalVariable = {
  id: string;
  label: string;
  type: ClinicalVariableType;
  identifier: string;
  createdAt: string;
};

export type AppUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  color: string;
  createdAt: string;
  createdBy?: string;
  demoPassword?: string;
};

export type PatientInput = {
  populationType?: PopulationType;
  firstName: string;
  lastName: string;
  age?: number;
  sex?: string;
  locality?: string;
  state?: string;
  birthPlace?: string;
  fatherBirthPlace?: string;
  motherBirthPlace?: string;
  bodyMassIndex?: number;
  height?: number;
  heightUnit?: "cm" | "m";
  weight?: number;
  symptomStartYear?: number;
  comorbidities?: string[];
  neurologicalSymptoms?: string[];
  educationLevel?: string;
  householdSize?: number;
  roomCount?: number;
  floorType?: string;
  housingType?: string;
  housingMaterial?: string;
  waterAccess?: string;
  sanitation?: string;
  overcrowding?: boolean;
  lifeConditions?: string;
  sampleCode?: string;
  diagnosis?: string;
  geneticStudy?: string;
  familyHistory?: string;
  contactPhone?: string;
  clinicalNotes?: string;
  customFields?: Record<string, unknown>;
};

export type Patient = PatientInput & {
  id: string;
  createdBy: string;
  createdByName: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
};

export type InventoryProductInput = {
  name: string;
  sku?: string;
  category?: string;
  unit?: string;
  stock: number;
  minStock: number;
  location?: string;
  notes?: string;
};

export type InventoryProduct = InventoryProductInput & {
  id: string;
  createdBy: string;
  createdByName: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
};

export type InventoryMovementType = "entrada" | "salida" | "ajuste";

export type InventoryMovement = {
  id: string;
  productId: string;
  productName: string;
  productSku?: string;
  type: InventoryMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  createdAt: string;
};

export type GeneticRecordInput = {
  patientId: string;
  genotyping?: string;
  relativeGeneQuantification?: string;
  solubleProteinLevels?: string;
  massiveSequencing?: string;
  notes?: string;
};

export type GeneticRecord = GeneticRecordInput & {
  id: string;
  createdBy: string;
  createdByName: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
};

export type ActivityLog = {
  id: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  action: string;
  entityType: "patient" | "user" | "report" | "import" | "session";
  entityId?: string;
  summary: string;
  createdAt: string;
};

export type AppNotification = {
  id: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  title: string;
  message: string;
  entityType: ActivityLog["entityType"];
  entityId?: string;
  readBy: string[];
  hiddenBy: string[];
  createdAt: string;
};

export type ReportFilters = {
  search: string;
  state: string;
  sex: string;
  from: string;
  to: string;
};

export type MetricBucket = {
  label: string;
  value: number;
  percent: number;
};

export type Metrics = {
  totalPatients: number;
  averageAge: number;
  medianAge: number;
  minAge: number;
  maxAge: number;
  recentPatients: number;
  housingCompleteness: number;
  byState: MetricBucket[];
  byLocality: MetricBucket[];
  bySex: MetricBucket[];
  byHousing: MetricBucket[];
};

export type ImportCandidate = {
  rowNumber: number;
  patient: PatientInput;
};

export type ImportError = {
  rowNumber: number;
  message: string;
};

export type ImportPreview = {
  fileName: string;
  validRows: ImportCandidate[];
  errors: ImportError[];
};
