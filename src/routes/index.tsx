import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  computeWeight,
  riskFromPoints,
  type RiskLevel,
  type Trafficability,
  type WaterLevel,
} from "@/lib/floodguard-geo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FloodGuard — Alerta e Mapa de Alagamentos Urbanos" },
      {
        name: "description",
        content:
          "Mapa de calor em tempo real de alagamentos urbanos, status de risco do seu entorno e reporte rápido em 3 toques.",
      },
      { property: "og:title", content: "FloodGuard — Alerta de Alagamentos" },
      {
        property: "og:description",
        content:
          "Veja o risco de alagamento no seu entorno e reporte pontos alagados em 3 toques.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  ssr: false,
  component: FloodGuardGate,
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
    s.onload = () => {
      const h = document.createElement("script");
      h.src = "https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js";
      h.onload = () => resolve(w.L);
      h.onerror = reject;
      document.body.appendChild(h);
    };
    s.onerror = reject;
    document.body.appendChild(s);
  });
  return w.__leafletReady;
}

function FloodGuardGate() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
      if (!session) navigate({ to: "/auth", replace: true });
    });
    supabase.auth.getSession().then(({ data: s }) => {
      setUserId(s.session?.user.id ?? null);
      if (!s.session) navigate({ to: "/auth", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  if (userId === undefined || userId === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-lg font-bold text-accent">Carregando FloodGuard...</p>
      </main>
    );
  }
  return <FloodGuard userId={userId} />;
}

function FloodGuard({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const heatRef = useRef<any>(null);
  const coordsRef = useRef({ lat: -23.5505, lng: -46.6333 });
  const [coords, setCoords] = useState({ lat: -23.5505, lng: -46.6333 });
  const [risk, setRisk] = useState<ReturnType<typeof riskFromPoints> | null>(null);
  const [emergency, setEmergency] = useState(false);
  const [modal, setModal] = useState(false);
  const [step, setStep] = useState(1);
  const [traffic, setTraffic] = useState<Trafficability | null>(null);
  const [water, setWater] = useState<WaterLevel | null>(null);
  const [profile, setProfile] = useState<{ display_name: string; points: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("flood_reports")
      .select("lat,lng,weight")
      .order("created_at", { ascending: false })
      .limit(1000);
    const points = data ?? [];
    const L = (window as any).L;
    if (L && mapRef.current) {
      if (heatRef.current) mapRef.current.removeLayer(heatRef.current);
      heatRef.current = L.heatLayer(
        points.map((p) => [p.lat, p.lng, p.weight]),
        {
          radius: 38,
          blur: 24,
          maxZoom: 17,
          minOpacity: 0.45,
          gradient: { 0.2: "#FFD700", 0.45: "#FF9800", 0.7: "#F44336", 1.0: "#7F0000" },
        },
      ).addTo(mapRef.current);
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
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap &copy; CARTO",
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
    return () => {
      cancelled = true;
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
      setToast("Reporte enviado! +10 pontos de Guardião");
      setModal(false);
      setStep(1);
      setTraffic(null);
      setWater(null);
      await Promise.all([refresh(), loadProfile()]);
    }
    setTimeout(() => setToast(null), 3500);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const riskToken = risk ? RISK_TOKEN[risk.level] : "risk-low";

  return (
    <main
      className={`relative min-h-screen bg-background text-foreground ${emergency ? "emergency" : ""}`}
    >
      <header className="sticky top-0 z-[1200] space-y-3 bg-background/95 p-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-accent">FloodGuard</h1>
            <p className="text-sm text-muted-foreground">
              {profile?.display_name ?? "Guardião"} · {profile?.points ?? 0} pts
            </p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="min-h-[48px] rounded-xl border-2 border-border px-4 text-sm font-bold text-muted-foreground"
          >
            Sair
          </button>
        </div>

        <section
          className="rounded-2xl border-4 p-4"
          style={{ borderColor: `var(--${riskToken})`, backgroundColor: "var(--card)" }}
          aria-live="polite"
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Status do Entorno (raio 1 km)
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
        </section>

        <button
          type="button"
          onClick={() => setEmergency((v) => !v)}
          className="min-h-[56px] w-full rounded-2xl border-4 border-accent text-lg font-black uppercase tracking-wide text-accent transition-colors data-[on=true]:bg-accent data-[on=true]:text-background"
          data-on={emergency}
        >
          {emergency ? "Modo Emergência ATIVO" : "Ativar Modo Emergência / Chuva Forte"}
        </button>
      </header>

      <div className="relative mx-4 mb-4 overflow-hidden rounded-2xl border-4 border-border">
        <div ref={mapEl} className="h-[58vh] min-h-[360px] w-full" />
      </div>

      <button
        type="button"
        onClick={() => setModal(true)}
        className="fixed bottom-6 right-4 z-[1300] min-h-[64px] rounded-2xl bg-danger px-6 text-lg font-black uppercase text-foreground shadow-2xl"
      >
        + Reportar Alagamento
      </button>

      {toast && (
        <div className="fixed bottom-28 left-1/2 z-[1400] w-[90%] max-w-sm -translate-x-1/2 rounded-xl border-2 border-accent bg-card p-4 text-center text-base font-bold text-accent">
          {toast}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[1500] flex items-end justify-center bg-black/80 p-3">
          <div className="w-full max-w-md rounded-3xl border-4 border-accent bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black text-accent">Reporte rápido · Passo {step}/3</h2>
              <button
                type="button"
                onClick={() => setModal(false)}
                className="min-h-[44px] px-3 text-2xl font-black text-muted-foreground"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            {step === 1 && (
              <div className="space-y-3">
                <p className="text-base font-semibold">1. Como está a via?</p>
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
    </main>
  );
}
