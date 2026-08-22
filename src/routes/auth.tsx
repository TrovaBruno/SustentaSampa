import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar no FloodGuard — Login e Cadastro" },
      {
        name: "description",
        content:
          "Acesse sua conta de Guardião da Cidade para ver o mapa de alagamentos e enviar reportes.",
      },
      { property: "og:title", content: "Entrar no FloodGuard" },
      {
        property: "og:description",
        content: "Login e cadastro do FloodGuard, o alerta de alagamentos urbanos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/", replace: true });
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) navigate({ to: "/", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setMsg("Cadastro criado! Confirme seu e-mail para entrar.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Falha na autenticação");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setMsg(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setMsg("Não foi possível entrar com Google.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border-4 border-accent bg-card p-6">
        <h1 className="text-3xl font-black text-accent">FloodGuard</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Entre para ver o mapa de calor e reportar alagamentos.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              data-on={mode === m}
              className="min-h-[56px] rounded-2xl border-4 border-border text-base font-black uppercase data-[on=true]:border-accent data-[on=true]:bg-accent data-[on=true]:text-background"
            >
              {m === "login" ? "Entrar" : "Cadastrar"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3">
          {mode === "signup" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome de Guardião"
              className="min-h-[56px] w-full rounded-2xl border-4 border-border bg-background px-4 text-base font-semibold text-foreground outline-none focus:border-accent"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            className="min-h-[56px] w-full rounded-2xl border-4 border-border bg-background px-4 text-base font-semibold text-foreground outline-none focus:border-accent"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha (mín. 6 caracteres)"
            className="min-h-[56px] w-full rounded-2xl border-4 border-border bg-background px-4 text-base font-semibold text-foreground outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy}
            className="min-h-[56px] w-full rounded-2xl bg-accent text-lg font-black uppercase text-background disabled:opacity-60"
          >
            {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          type="button"
          onClick={google}
          className="mt-3 min-h-[56px] w-full rounded-2xl border-4 border-accent text-base font-black uppercase text-accent"
        >
          Continuar com Google
        </button>

        {msg && (
          <p className="mt-4 rounded-xl border-2 border-accent p-3 text-center text-sm font-bold text-accent">
            {msg}
          </p>
        )}
      </div>
    </main>
  );
}
