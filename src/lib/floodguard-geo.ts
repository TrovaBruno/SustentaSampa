export type Trafficability = "transitavel" | "veiculos_altos" | "intransitavel";
export type WaterLevel = "canela" | "joelho" | "acima_capo";

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

/** Distância geográfica em km (fórmula de Haversine). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type RiskLevel = "Baixo" | "Médio" | "Alto" | "Crítico";

export function riskFromPoints(
  lat: number,
  lng: number,
  points: Array<{ lat: number; lng: number; weight: number }>,
  radiusKm = 1,
) {
  const nearby = points.filter((p) => haversineKm(lat, lng, p.lat, p.lng) <= radiusKm);
  const score = nearby.reduce((acc, p) => acc + p.weight, 0);
  let level: RiskLevel = "Baixo";
  if (score >= 3.5) level = "Crítico";
  else if (score >= 2) level = "Alto";
  else if (score >= 0.8) level = "Médio";
  return { level, score: Number(score.toFixed(2)), reportsNearby: nearby.length, radiusKm };
}
