export type RiverLevel = "Baixo" | "Médio" | "Alto" | "Indisponível";

export type EnvironmentData = {
  temperature: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  precipitation: number | null;
  isRaining: boolean;
  humidity: number | null;
  rainProbability: number | null;
  river: {
    level: RiverLevel;
    discharge: number | null;
    average: number | null;
  };
};

/** Dados meteorológicos abertos (Open-Meteo, sem chave de API). */
export async function fetchEnvironment(lat: number, lng: number): Promise<EnvironmentData> {
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m,wind_direction_10m` +
    `&hourly=precipitation_probability&forecast_days=1&timezone=auto`;

  const floodUrl =
    `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lng}` +
    `&daily=river_discharge&past_days=31&forecast_days=1`;

  const [weatherRes, floodRes] = await Promise.allSettled([
    fetch(weatherUrl).then((r) => r.json()),
    fetch(floodUrl).then((r) => r.json()),
  ]);

  const w = weatherRes.status === "fulfilled" ? weatherRes.value : null;
  const cur = w?.current ?? {};

  let rainProbability: number | null = null;
  if (w?.hourly?.precipitation_probability?.length) {
    const hour = new Date().getHours();
    rainProbability = w.hourly.precipitation_probability[hour] ?? null;
  }

  const river = riverLevel(floodRes.status === "fulfilled" ? floodRes.value : null);

  return {
    temperature: numOrNull(cur.temperature_2m),
    windSpeed: numOrNull(cur.wind_speed_10m),
    windDirection: numOrNull(cur.wind_direction_10m),
    precipitation: numOrNull(cur.precipitation),
    isRaining: Number(cur.rain ?? cur.precipitation ?? 0) > 0,
    humidity: numOrNull(cur.relative_humidity_2m),
    rainProbability,
    river,
  };
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function riverLevel(flood: any): EnvironmentData["river"] {
  const series: Array<number | null> = flood?.daily?.river_discharge ?? [];
  const values = series.filter((v): v is number => typeof v === "number");
  if (values.length < 5) return { level: "Indisponível", discharge: null, average: null };
  const current = values[values.length - 1]!;
  const history = values.slice(0, -1);
  const average = history.reduce((a, b) => a + b, 0) / history.length;
  const ratio = average > 0 ? current / average : 1;
  const level: RiverLevel = ratio >= 1.35 ? "Alto" : ratio <= 0.7 ? "Baixo" : "Médio";
  return { level, discharge: Number(current.toFixed(2)), average: Number(average.toFixed(2)) };
}

export function windDirectionLabel(deg: number | null): string {
  if (deg === null) return "—";
  const dirs = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
  return dirs[Math.round(deg / 45) % 8]!;
}
