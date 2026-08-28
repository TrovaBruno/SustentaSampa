import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen, Page, PageHeader, useAuthGate } from "@/components/AppShell";
import {
  clusterReports,
  since24hISO,
  CRITICAL_CLUSTER_COUNT,
  type ReportPoint,
} from "@/lib/floodguard-clusters";
import {
  computeWeight,
  riskFromPoints,
  type RiskLevel,
  type Trafficability,
  type WaterLevel,
} from "@/lib/floodguard-geo";
import { resolveCepFromCoords, type CepLocation } from "@/lib/cep";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SustentaSampa — Alerta e Mapa de Alagamentos Urbanos" },
      {
        name: "description",
        content:
          "Mapa em tempo real de alagamentos urbanos das últimas 24 horas, status de risco do seu entorno e reporte rápido em 3 toques.",
      },
      { property: "og:title", content: "SustentaSampa — Alerta de Alagamentos" },
      {
        property: "og:description",
        content: "Veja o risco de alagamento no seu entorno e reporte pontos alagados em 3 toques.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  ssr: false,
  component: SustentaSampaGate,
});

const RISK_TOKEN: Record<RiskLevel, string> = {
  Baixo: "risk-low",
  "Médio": "risk-mid",
  Alto: "risk-high",
  "Crítico": "risk-critical",
};

function loadLeaflet(): Promise<any> {
  const w = window as any;
  if (w.__leafletReady) return w.__leafletReady;
  w.__leafletReady = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => resolve(w.L);
    s.onerror = reject;
    document.body.appendChild(s);
  });
  return w.__leafletReady;
}

function SustentaSampaGate() {
  const userId = useAuthGate();
  if (!userId) return <LoadingScreen />;
  return <SustentaSampa userId={userId} />;
}

function SustentaSampa({ userId }: { userId: string }) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const coordsRef = useRef({ lat: -23.5505, lng: -46.6333 });
  const [coords, setCoords] = useState({ lat: -23.5505, lng: -46.6333 });
  const [risk, setRisk] = useState<ReturnType<typeof riskFromPoints> | null>(null);
  const [hotspots, setHotspots] = useState(0);
  const [emergency, setEmergency] = useState(false);
  const [modal, setModal] = useState(false);
  const [step, setStep] = useState(1);
  const [traffic, setTraffic] = useState<Trafficability | null>(null);
  const [water, setWater] = useState<WaterLevel | null>(null);
  const [profile, setProfile] = useState<{ display_name: string; points: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [cepInfo, setCepInfo] = useState<CepLocation | null>(null);
  const [cepLoading, setCepLoading] = useState(false);


  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("flood_reports")
      .select("lat,lng,weight,created_at,cep")
      .gte("created_at", since24hISO())
      .order("created_at", { ascending: false })
      .limit(2000);
    const points = (data ?? []) as ReportPoint[];
    const clusters = clusterReports(points);
    setHotspots(clusters.filter((c) => c.critical).length);

    const L = (window as any).L;
    if (L && mapRef.current) {
      if (layerRef.current) mapRef.current.removeLayer(layerRef.current);
      const group = L.layerGroup();
      for (const c of clusters) {
        const color = c.critical ? "#F44336" : "#FF9800";
        L.circle([c.lat, c.lng], {
          radius: 260 + Math.min(240, c.count * 20),
          color,
          weight: 3,
          fillColor: color,
          fillOpacity: c.critical ? 0.45 : 0.3,
          className: c.critical ? "cluster-critical" : "cluster-warning",
        })
          .bindPopup(
            `<b>${c.count} reporte(s)</b> nas últimas 24h<br/>${
              c.cep ? `CEP ${c.cep}<br/>` : ""
            }${c.critical ? "Região crítica (10+ reportes)" : "Região em atenção"}`,
          )
          .addTo(group);
      }
      group.addTo(mapRef.current);
      layerRef.current = group;
    }
    setRisk(riskFromPoints(coordsRef.current.lat, coordsRef.current.lng, points));
  }, []);


  const loadProfile = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("display_name,points")
      .eq("id", userId)
      .maybeSingle();
    if (data) setProfile(data);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    loadProfile();
    loadLeaflet().then((L) => {
      if (cancelled || !mapEl.current || mapRef.current) return;
      const map = L.map(mapEl.current, { zoomControl: false }).setView(
        [coordsRef.current.lat, coordsRef.current.lng],
        15,
      );
      L.control.zoom({ position: "topright" }).addTo(map);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      refresh();

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            coordsRef.current = c;
            setCoords(c);
            map.setView([c.lat, c.lng], 15);
            refresh();
          },
          () => undefined,
          { timeout: 8000 },
        );
      }
    });
    const timer = setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refresh, loadProfile]);

  async function submitReport() {
    if (!traffic || !water) return;
    setSending(true);
    const { error } = await supabase.from("flood_reports").insert({
      user_id: userId,
      lat: coords.lat,
      lng: coords.lng,
      trafficability: traffic,
      water_level: water,
      weight: computeWeight(traffic, water),
    });
    setSending(false);
    if (error) {
      setToast("Não foi possível enviar o reporte.");
    } else {
      setToast("Reporte enviado! +10 pontos");
      setModal(false);
      setStep(1);
      setTraffic(null);
      setWater(null);
      await Promise.all([refresh(), loadProfile()]);
    }
    setTimeout(() => setToast(null), 3500);
  }

  const riskToken = risk ? RISK_TOKEN[risk.level] : "risk-low";

  return (
    <div className={emergency ? "emergency" : undefined}>
      <Page>
        <PageHeader
          title="SustentaSampa"
          subtitle={`${profile?.display_name ?? "Nome"} · ${profile?.points ?? 0} pts`}
        />

        <div className="space-y-3 px-4">
          <section
            className="rounded-2xl border-4 p-4"
            style={{ borderColor: `var(--${riskToken})`, backgroundColor: "var(--card)" }}
            aria-live="polite"
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Status do Entorno (raio 1 km · últimas 24h)
            </p>
            <p
              className="mt-1 text-4xl font-black leading-none"
              style={{ color: `var(--${riskToken})` }}
            >
              {risk ? `RISCO ${risk.level.toUpperCase()}` : "CARREGANDO..."}
            </p>
            <p className="mt-2 text-base font-medium text-foreground">
              {risk
                ? `${risk.reportsNearby} reporte(s) ativo(s) por perto · índice ${risk.score}`
                : "Buscando sua localização"}
            </p>
            <p className="mt-1 text-sm font-bold" style={{ color: "var(--risk-critical)" }}>
              {hotspots > 0
                ? `${hotspots} região(ões) crítica(s) piscando no mapa (${CRITICAL_CLUSTER_COUNT}+ reportes)`
                : ""}
            </p>
          </section>

          <button
            type="button"
            onClick={() => setEmergency((v) => !v)}
            className="min-h-[56px] w-full rounded-2xl border-4 border-accent text-lg font-black uppercase tracking-wide text-accent transition-colors data-[on=true]:bg-accent data-[on=true]:text-background"
            data-on={emergency}
          >
            {emergency ? "Modo Emergência ATIVO" : "Ativar Modo Emergência / Chuva Forte"}
          </button>

          <div className="relative overflow-hidden rounded-2xl border-4 border-border">
            <div ref={mapEl} className="h-[52vh] min-h-[320px] w-full" />
          </div>

          <div className="flex flex-wrap gap-3 pb-2 text-sm font-bold">
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-4 w-4 rounded-full"
                style={{ background: "#FF9800" }}
              />
              Menos de {CRITICAL_CLUSTER_COUNT} reportes
            </span>
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="legend-blink inline-block h-4 w-4 rounded-full"
                style={{ background: "#F44336" }}
              />
              {CRITICAL_CLUSTER_COUNT}+ reportes (crítico)
            </span>
            <span className="text-muted-foreground">Reportes somem após 24h</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setModal(true)}
          className="fixed bottom-24 right-4 z-[1550] min-h-[64px] rounded-2xl bg-danger px-6 text-lg font-black uppercase text-foreground shadow-2xl"
        >
          + Reportar Alagamento
        </button>

        {toast && (
          <div className="fixed bottom-44 left-1/2 z-[1700] w-[90%] max-w-sm -translate-x-1/2 rounded-xl border-2 border-accent bg-card p-4 text-center text-base font-bold text-accent">
            {toast}
          </div>
        )}

        {modal && (
          <div className="fixed inset-0 z-[1800] flex items-end justify-center bg-black/80 p-3">
            <div className="w-full max-w-md rounded-3xl border-4 border-accent bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-black text-accent">Reporte Rápido</h2>
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="min-h-[44px] px-3 text-base font-bold text-muted-foreground"
                >
                  Fechar
                </button>
              </div>

              {step === 1 && (
                <div className="space-y-3">
                  <p className="text-base font-semibold">1. Transitabilidade</p>
                  {(
                    [
                      ["transitavel", "Transitável"],
                      ["veiculos_altos", "Apenas Veículos Altos"],
                      ["intransitavel", "Intransitável"],
                    ] as Array<[Trafficability, string]>
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setTraffic(v);
                        setStep(2);
                      }}
                      className="min-h-[56px] w-full rounded-2xl border-4 border-border px-4 text-lg font-bold data-[sel=true]:border-accent data-[sel=true]:text-accent"
                      data-sel={traffic === v}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <p className="text-base font-semibold">2. Nível da água</p>
                  {(
                    [
                      ["canela", "Canela"],
                      ["joelho", "Joelho"],
                      ["acima_capo", "Acima do Capô"],
                    ] as Array<[WaterLevel, string]>
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setWater(v);
                        setStep(3);
                      }}
                      className="min-h-[56px] w-full rounded-2xl border-4 border-border px-4 text-lg font-bold data-[sel=true]:border-accent data-[sel=true]:text-accent"
                      data-sel={water === v}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <p className="text-base font-semibold">3. Confirmar e enviar</p>
                  <p className="text-sm text-muted-foreground">
                    Local: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  </p>
                  <button
                    type="button"
                    disabled={sending}
                    onClick={submitReport}
                    className="min-h-[56px] w-full rounded-2xl bg-accent text-lg font-black uppercase text-background disabled:opacity-60"
                  >
                    {sending ? "Enviando..." : "Enviar Reporte (+10 pts)"}
                  </button>
                </div>
              )}

              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="mt-4 min-h-[48px] w-full rounded-xl border-2 border-border text-base font-bold text-muted-foreground"
                >
                  Voltar
                </button>
              )}
            </div>
          </div>
        )}
      </Page>
    </div>
  );
}
