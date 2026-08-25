import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useAuthGate() {
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

  return userId;
}

export function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-lg font-bold text-accent">Carregando SustentaSampa...</p>
    </main>
  );
}

const TABS = [
  { to: "/", label: "Mapa", icon: "🗺️" },
  { to: "/chat", label: "Chat", icon: "💬" },
  { to: "/probabilidade", label: "Probabilidade", icon: "🌧️" },
] as const;

export function BottomNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-[1600] grid grid-cols-3 border-t-4 border-border bg-background"
    >
      {TABS.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          activeOptions={{ exact: t.to === "/" }}
          activeProps={{ className: "text-accent border-t-4 border-accent -mt-1" }}
          className="flex min-h-[64px] flex-col items-center justify-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground"
        >
          <span aria-hidden className="text-xl">
            {t.icon}
          </span>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <header className="flex items-center justify-between gap-3 bg-background/95 p-4 backdrop-blur">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-accent">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <button
        type="button"
        onClick={signOut}
        className="min-h-[48px] rounded-xl border-2 border-border px-4 text-sm font-bold text-muted-foreground"
      >
        Sair
      </button>
    </header>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background pb-24 text-foreground">
      {children}
      <BottomNav />
    </main>
  );
}
