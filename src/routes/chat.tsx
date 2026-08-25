import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen, Page, PageHeader, useAuthGate } from "@/components/AppShell";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat da Comunidade — SustentaSampa" },
      {
        name: "description",
        content:
          "Converse em tempo real com vizinhos sobre alagamentos, rotas alternativas e pedidos de ajuda na sua região.",
      },
      { property: "og:title", content: "Chat da Comunidade — SustentaSampa" },
      {
        property: "og:description",
        content: "Troque informações em tempo real sobre alagamentos com pessoas da sua região.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  ssr: false,
  component: ChatGate,
});

type Message = {
  id: string;
  user_id: string;
  display_name: string;
  content: string;
  created_at: string;
};

function ChatGate() {
  const userId = useAuthGate();
  if (!userId) return <LoadingScreen />;
  return <ChatPage userId={userId} />;
}

function ChatPage({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [name, setName] = useState("Nome");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => data?.display_name && setName(data.display_name));

    supabase
      .from("chat_messages")
      .select("id,user_id,display_name,content,created_at")
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data }) => {
        setMessages((data as Message[]) ?? []);
        scrollDown();
      });

    const channel = supabase
      .channel("chat_messages_live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === (payload.new as Message).id)
              ? prev
              : [...prev, payload.new as Message],
          );
          scrollDown();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, scrollDown]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    const { error } = await supabase
      .from("chat_messages")
      .insert({ user_id: userId, display_name: name, content });
    setSending(false);
    if (!error) {
      setText("");
      scrollDown();
    }
  }

  return (
    <Page>
      <PageHeader title="Chat da Comunidade" subtitle={`Você aparece como ${name}`} />

      <div
        ref={listRef}
        className="mx-4 h-[62vh] space-y-3 overflow-y-auto rounded-2xl border-4 border-border bg-card p-4"
      >
        {messages.length === 0 && (
          <p className="text-center text-base text-muted-foreground">
            Nenhuma mensagem ainda. Comece a conversa sobre o que está acontecendo na sua rua.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.user_id === userId;
          return (
            <div key={m.id} className={mine ? "text-right" : "text-left"}>
              <div
                className={`inline-block max-w-[85%] rounded-2xl border-2 px-4 py-2 text-left ${
                  mine ? "border-accent bg-accent/10" : "border-border bg-background"
                }`}
              >
                <p className="text-xs font-black uppercase tracking-wide text-accent">
                  {mine ? "Você" : m.display_name}
                </p>
                <p className="whitespace-pre-wrap break-words text-base font-medium">{m.content}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={send} className="mx-4 mt-3 flex gap-2">
        <label htmlFor="chat-input" className="sr-only">
          Mensagem
        </label>
        <input
          id="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder="Escreva uma mensagem..."
          className="min-h-[56px] flex-1 rounded-2xl border-4 border-border bg-card px-4 text-base font-medium text-foreground placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="min-h-[56px] rounded-2xl bg-accent px-5 text-base font-black uppercase text-background disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </Page>
  );
}
