import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LoadingScreen, Page, PageHeader, useAuthGate } from "@/components/AppShell";
import { fetchEnvironment, windDirectionLabel, type EnvironmentData } from "@/lib/weather";

export const Route = createFileRoute("/probabilidade")({
  head: () => ({
    meta: [
      { title: "Probabilidade de Alagamento — SustentaSampa" },
      {
        name: "description",
        content:
          "Monitore vento, chuva, temperatura e o nível do rio mais próximo para antecipar alagamentos na sua região.",
      },
      { property: "og:title", content: "Probabilidade de Alagamento — SustentaSampa" },
      {
        property: "og:description",
        content: "Vento, chuva, temperatura e nível do rio próximo em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  ssr: false,
  component: ProbGate,
});

function ProbGate() {
  const userId = useAuthGate();
  if (!userId) return <LoadingScreen />;
  return <ProbabilidadePage />;
}

const RIVER_TOKEN: Record<string, string> = {
  Baixo: "risk-low",
  "Médio": "risk-mid",
  Alto: "risk-critical",
  "Indisponível": "muted-foreground",
};

function ProbabilidadePage() {
  const [env, setEnv] = useState<EnvironmentData | null>(null);
  const [error, setError] = useState(false);
  const [coords, setCoords] = useState({ lat: -23.5505, lng: -46.6333 });

  useEffect(() => {
    let active = true;
    function load(lat: number, lng: number) {
      fetchEnvironment(lat, lng)
        .then((d) => active && setEnv(d))
        .catch(() => active && setError(true));
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (!active) return;
          setCoords(c);
          load(c.lat, c.lng);
        },
        () => load(coords.lat, coords.lng),
        { timeout: 8000 },
      );
    } else {
      load(coords.lat, coords.lng);
    }
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prob = env ? floodProbability(env) : null;

  return (
    <Page>
      <PageHeader
        title="Probabilidade"
        subtitle={`Monitoramento em ${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`}
      />

      <div className="space-y-4 px-4">
        {error && (
          <p className="rounded-2xl border-4 border-danger p-4 text-base font-bold">
            Não foi possível consultar os dados meteorológicos agora.
          </p>
        )}

        {prob && (
          <section
            className="rounded-2xl border-4 bg-card p-4"
            style={{ borderColor: `var(--${prob.token})` }}
            aria-live="polite"
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Probabilidade de alagamento
            </p>
            <p className="mt-1 text-4xl font-black" style={{ color: `var(--${prob.token})` }}>
              {prob.label.toUpperCase()} · {prob.percent}%
            </p>
            <p className="mt-2 text-base font-medium">{prob.reason}</p>
          </section>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Metric
            label="Chovendo agora"
            value={env ? (env.isRaining ? "SIM" : "NÃO") : "..."}
            hint={env ? `${env.precipitation ?? 0} mm na última hora` : ""}
          />
          <Metric
            label="Chance de chuva"
            value={env?.rainProbability != null ? `${env.rainProbability}%` : "—"}
            hint="Próxima hora"
          />
          <Metric
            label="Temperatura"
            value={env?.temperature != null ? `${env.temperature}°C` : "..."}
            hint={env?.humidity != null ? `Umidade ${env.humidity}%` : ""}
          />
          <Metric
            label="Vento"
            value={env?.windSpeed != null ? `${env.windSpeed} km/h` : "..."}
            hint={`Direção ${windDirectionLabel(env?.windDirection ?? null)}`}
          />
        </div>

        <section
          className="rounded-2xl border-4 bg-card p-4"
          style={{ borderColor: `var(--${RIVER_TOKEN[env?.river.level ?? "Indisponível"]})` }}
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Nível do rio mais próximo
          </p>
          <p
            className="mt-1 text-3xl font-black"
            style={{ color: `var(--${RIVER_TOKEN[env?.river.level ?? "Indisponível"]})` }}
          >
            {env?.river.level ?? "..."}
          </p>
          <p className="mt-2 text-base font-medium text-muted-foreground">
            {env?.river.discharge != null
              ? `Vazão atual ${env.river.discharge} m³/s · média do mês ${env.river.average} m³/s`
              : "Sem estação de vazão monitorada por perto."}
          </p>
        </section>

        <p className="pb-4 text-xs text-muted-foreground">
          Fontes abertas: Open-Meteo (previsão) e Open-Meteo Flood / GloFAS (vazão de rios).
        </p>
      </div>
    </Page>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border-4 border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function floodProbability(env: EnvironmentData) {
  let score = 0;
  if (env.isRaining) score += 30;
  score += Math.min(25, (env.precipitation ?? 0) * 10);
  score += Math.min(20, (env.rainProbability ?? 0) * 0.2);
  if (env.river.level === "Alto") score += 30;
  else if (env.river.level === "Médio") score += 12;
  if ((env.windSpeed ?? 0) > 35) score += 5;
  const percent = Math.max(3, Math.min(99, Math.round(score)));
  const label = percent >= 70 ? "Crítica" : percent >= 45 ? "Alta" : percent >= 20 ? "Média" : "Baixa";
  const token =
    percent >= 70 ? "risk-critical" : percent >= 45 ? "risk-high" : percent >= 20 ? "risk-mid" : "risk-low";
  const reason = [
    env.isRaining ? "Está chovendo agora" : "Sem chuva no momento",
    `rio ${env.river.level.toLowerCase()}`,
    `vento ${env.windSpeed ?? 0} km/h`,
  ].join(" · ");
  return { percent, label, token, reason };
}
