export type ReportPoint = { lat: number; lng: number; weight: number; created_at?: string };

export type Cluster = {
  key: string;
  lat: number;
  lng: number;
  count: number;
  weight: number;
  /** true quando 10 ou mais reportes na mesma região → vermelho piscando */
  critical: boolean;
};

/** Tamanho da célula da grade em graus (~550 m). */
const CELL = 0.005;

/** Limite de reportes na mesma região para virar vermelho piscante. */
export const CRITICAL_CLUSTER_COUNT = 10;

/** Agrupa reportes por região (grade geográfica) para colorir o mapa. */
export function clusterReports(points: ReportPoint[]): Cluster[] {
  const cells = new Map<string, { lat: number; lng: number; count: number; weight: number }>();
  for (const p of points) {
    const key = `${Math.round(p.lat / CELL)}:${Math.round(p.lng / CELL)}`;
    const cur = cells.get(key) ?? { lat: 0, lng: 0, count: 0, weight: 0 };
    cur.lat += p.lat;
    cur.lng += p.lng;
    cur.count += 1;
    cur.weight += p.weight;
    cells.set(key, cur);
  }
  return Array.from(cells.entries()).map(([key, c]) => ({
    key,
    lat: c.lat / c.count,
    lng: c.lng / c.count,
    count: c.count,
    weight: Number((c.weight / c.count).toFixed(2)),
    critical: c.count >= CRITICAL_CLUSTER_COUNT,
  }));
}

/** ISO do instante 24 h atrás — reportes mais antigos somem do mapa. */
export function since24hISO(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}
