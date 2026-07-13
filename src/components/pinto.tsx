"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, X, Send } from "lucide-react";
import { useT } from "@/lib/useT";

interface Msg { role: "user" | "assistant"; content: string }

// Floating help assistant available on every page.
export function Pinto() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", content: t("pinto.hello") }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useMutation({
    mutationFn: async (history: Msg[]) => {
      const res = await fetch("/api/pinto/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only real turns go to the API (skip the local greeting).
        body: JSON.stringify({ messages: history.filter((m, i) => !(i === 0 && m.role === "assistant")) }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || "failed");
      return b.reply as string;
    },
    onSuccess: (reply) => setMessages((m) => [...m, { role: "assistant", content: reply }]),
    onError: () => setMessages((m) => [...m, { role: "assistant", content: t("pinto.error") }]),
  });

  function submit() {
    const text = input.trim();
    if (!text || send.isPending) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    send.mutate(next);
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg transition hover:bg-brand-700"
          aria-label="Pinto"
        >
          <Bot size={26} />
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[32rem] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between bg-brand px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20"><Bot size={18} /></div>
              <div>
                <div className="text-sm font-semibold leading-tight">Pinto</div>
                <div className="text-[11px] leading-tight text-white/80">{t("pinto.tagline")}</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 hover:bg-white/20"><X size={18} /></button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm " +
                  (m.role === "user"
                    ? "bg-brand text-white"
                    : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100")
                }>
                  {m.content}
                </div>
              </div>
            ))}
            {send.isPending && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-400 dark:bg-slate-800">
                  {t("pinto.thinking")}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 p-2 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <input
                className="h-10 flex-1 rounded-full border border-slate-300 bg-white px-4 text-sm outline-none focus:border-brand dark:border-slate-700 dark:bg-slate-900"
                placeholder={t("pinto.placeholder")}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              />
              <button
                onClick={submit}
                disabled={!input.trim() || send.isPending}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white disabled:opacity-50"
                aria-label={t("pinto.send")}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
