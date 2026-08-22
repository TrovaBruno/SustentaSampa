/**
 * Estrutura de dados em memória — maleável.
 * Basta trocar as funções abaixo por queries SQL/NoSQL mantendo as assinaturas.
 */

export type Trafficability = "transitavel" | "veiculos_altos" | "intransitavel";
export type WaterLevel = "canela" | "joelho" | "acima_capo";

export interface FloodReport {
  id: string;
  lat: number;
  lng: number;
  trafficability: Trafficability;
  waterLevel: WaterLevel;
  weight: number;
  createdAt: string;
  userId: string;
}

export interface UserProfile {
  id: string;
  name: string;
  points: number;
  reports: number;
}

const WEIGHTS: Record<Trafficability, number> = {
  transitavel: 0.35,
  veiculos_altos: 0.7,
  intransitavel: 1,
};

const LEVEL_BOOST: Record<WaterLevel, number> = {
  canela: 0,
  joelho: 0.1,
  acima_capo: 0.25,
};

export function computeWeight(t: Trafficability, w: WaterLevel): number {
  return Math.min(1, WEIGHTS[t] + LEVEL_BOOST[w]);
}

// Seed — São Paulo, região central
const seed: Array<[number, number, Trafficability, WaterLevel]> = [
  [-23.5505, -46.6333, "intransitavel", "acima_capo"],
  [-23.5535, -46.6395, "veiculos_altos", "joelho"],
  [-23.5478, -46.6289, "transitavel", "canela"],
  [-23.5561, -46.6421, "intransitavel", "joelho"],
  [-23.5442, -46.6355, "veiculos_altos", "canela"],
  [-23.5589, -46.6301, "transitavel", "canela"],
  [-23.5512, -46.6448, "intransitavel", "acima_capo"],
];

const reports: FloodReport[] = seed.map((s, i) => ({
  id: `seed-${i}`,
  lat: s[0],
  lng: s[1],
  trafficability: s[2],
  waterLevel: s[3],
  weight: computeWeight(s[2], s[3]),
  createdAt: new Date(Date.now() - i * 12 * 60 * 1000).toISOString(),
  userId: "guardiao-1",
}));

const users = new Map<string, UserProfile>([
  ["guardiao-1", { id: "guardiao-1", name: "Guardião da Cidade", points: 40, reports: 4 }],
]);

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function listReports(): FloodReport[] {
  return reports;
}

export function heatmapData(): Array<[number, number, number]> {
  return reports.map((r) => [r.lat, r.lng, r.weight]);
}

export function riskStatus(lat: number, lng: number) {
  const radiusKm = 1;
  const nearby = reports.filter((r) => haversineKm(lat, lng, r.lat, r.lng) <= radiusKm);
  const score = nearby.reduce((acc, r) => acc + r.weight, 0);
  let level: "Baixo" | "Médio" | "Alto" | "Crítico" = "Baixo";
  if (score >= 3.5) level = "Crítico";
  else if (score >= 2) level = "Alto";
  else if (score >= 0.8) level = "Médio";
  return {
    level,
    score: Number(score.toFixed(2)),
    reportsNearby: nearby.length,
    radiusKm,
  };
}

export function addReport(input: {
  lat: number;
  lng: number;
  trafficability: Trafficability;
  waterLevel: WaterLevel;
  userId?: string;
}) {
  const userId = input.userId ?? "guardiao-1";
  const report: FloodReport = {
    id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    lat: input.lat,
    lng: input.lng,
    trafficability: input.trafficability,
    waterLevel: input.waterLevel,
    weight: computeWeight(input.trafficability, input.waterLevel),
    createdAt: new Date().toISOString(),
    userId,
  };
  reports.push(report);

  const user =
    users.get(userId) ?? { id: userId, name: "Guardião da Cidade", points: 0, reports: 0 };
  user.points += 10;
  user.reports += 1;
  users.set(userId, user);

  return { report, user };
}

export function getUser(userId = "guardiao-1"): UserProfile {
  return users.get(userId) ?? { id: userId, name: "Guardião da Cidade", points: 0, reports: 0 };
}
