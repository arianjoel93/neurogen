import type { Metrics, Patient, ReportFilters } from "../types";
import { patientSearchText } from "./normalization";

function asPercent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function bucketize(values: string[], total: number) {
  const counts = values.reduce<Record<string, number>>((accumulator, value) => {
    const label = value || "Sin Dato";
    accumulator[label] = (accumulator[label] ?? 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts)
    .map(([label, value]) => ({
      label,
      value,
      percent: asPercent(value, total),
    }))
    .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label));
}

export function calculateMetrics(patients: Patient[]): Metrics {
  const totalPatients = patients.length;
  const ages = patients
    .map((patient) => patient.age)
    .filter((age): age is number => typeof age === "number" && Number.isFinite(age))
    .sort((first, second) => first - second);
  const ageTotal = ages.reduce((sum, age) => sum + age, 0);
  const midpoint = Math.floor(ages.length / 2);
  const medianAge =
    ages.length === 0
      ? 0
      : ages.length % 2
        ? ages[midpoint]
        : Math.round((ages[midpoint - 1] + ages[midpoint]) / 2);
  const sevenDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 7;
  const withHousingData = patients.filter(
    (patient) => patient.housingType || patient.housingMaterial || patient.lifeConditions,
  ).length;

  return {
    totalPatients,
    averageAge: ages.length ? Math.round(ageTotal / ages.length) : 0,
    medianAge,
    minAge: ages[0] ?? 0,
    maxAge: ages[ages.length - 1] ?? 0,
    recentPatients: patients.filter((patient) => new Date(patient.createdAt).getTime() >= sevenDaysAgo)
      .length,
    housingCompleteness: asPercent(withHousingData, totalPatients),
    byState: bucketize(
      patients.map((patient) => patient.state ?? ""),
      totalPatients,
    ),
    byLocality: bucketize(
      patients.map((patient) => patient.locality ?? ""),
      totalPatients,
    ),
    bySex: bucketize(
      patients.map((patient) => patient.sex ?? ""),
      totalPatients,
    ),
    byHousing: bucketize(
      patients.map((patient) => patient.housingType ?? ""),
      totalPatients,
    ),
  };
}

export function filterPatients(patients: Patient[], filters: ReportFilters) {
  const query = filters.search.trim().toLocaleLowerCase("es-MX");
  const from = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : null;
  const to = filters.to ? new Date(`${filters.to}T23:59:59`).getTime() : null;

  return patients.filter((patient) => {
    const createdAt = new Date(patient.createdAt).getTime();
    const matchesSearch = !query || patientSearchText(patient).includes(query);
    const matchesState = !filters.state || patient.state === filters.state;
    const matchesSex = !filters.sex || patient.sex === filters.sex;
    const matchesFrom = from === null || createdAt >= from;
    const matchesTo = to === null || createdAt <= to;

    return matchesSearch && matchesState && matchesSex && matchesFrom && matchesTo;
  });
}
