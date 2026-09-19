import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, CornerDownLeft, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { navigatorChat, type NavigatorChatResponse, type NavigatorEpisode, type NavigatorSuggestion } from "@/lib/navigator-api";

const CACHE_KEY = "wayfinder.navigator.v0.4";
const MAX_MESSAGES = 40;
const MAX_REWIND_STATES = 16;

type ChatMessage = {
  id: string;
  role: "NAV" | "PLAYER";
  text: string;
  confirmed?: boolean;
};

type ChatState = {
  messages: ChatMessage[];
  episode: NavigatorEpisode | null;
  suggestions: NavigatorSuggestion[];
};

type CachedState = ChatState & {
  rewind: ChatState[];
};

type Props = {
  displayName: string;
  onCanonicalChange?: () => Promise<void> | void;
};

function initialState(displayName: string): ChatState {
  return {
    messages: [
      {
        id: crypto.randomUUID(),
        role: "NAV",
        text: `What’s going on, ${displayName}? Tell me naturally. I’ll carry the meaning across turns, ask only when something materially needs resolving, and nothing becomes canonical unless a domain can own it and you confirm it.`
      }
    ],
    episode: null,
    suggestions: []
  };
}

function readCache(displayName: string): CachedState {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return { ...initialState(displayName), rewind: [] };
    const parsed = JSON.parse(raw) as CachedState;
    if (!Array.isArray(parsed.messages)) throw new Error("INVALID_CACHE");
    return {
      messages: parsed.messages.slice(-MAX_MESSAGES),
      episode: parsed.episode ?? null,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      rewind: Array.isArray(parsed.rewind) ? parsed.rewind.slice(-MAX_REWIND_STATES) : []
    };
  } catch {
    return { ...initialState(displayName), rewind: [] };
  }
}

function persist(state: ChatState, rewind: ChatState[]) {
  const value: CachedState = {
    messages: state.messages.slice(-MAX_MESSAGES),
    episode: state.episode,
    suggestions: state.suggestions,
    rewind: rewind.slice(-MAX_REWIND_STATES).map((item) => ({
      ...item,
      messages: item.messages.slice(-MAX_MESSAGES)
    }))
  };
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(value));
}

function stateFromResponse(previous: ChatState, response: NavigatorChatResponse) {
  const nextMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "NAV",
    text: response.message,
    confirmed: response.confirmed === true
  };
  return {
    messages: [...previous.messages, nextMessage].slice(-MAX_MESSAGES),
    episode: response.episode,
    suggestions: response.suggestions ?? []
  } satisfies ChatState;
}

function suggestionClass(tone?: NavigatorSuggestion["tone"]) {
  if (tone === "primary") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/15";
  if (tone === "quiet") return "border-white/[0.06] bg-transparent text-slate-500 hover:text-slate-300";
  return "border-white/[0.08] bg-white/[0.035] text-slate-300 hover:bg-white/[0.06]";
}

export function NavigatorChat({ displayName, onCanonicalChange }: Props) {
  const cached = useMemo(() => readCache(displayName), [displayName]);
  const [state, setState] = useState<ChatState>({ messages: cached.messages, episode: cached.episode, suggestions: cached.suggestions });
  const [rewind, setRewind] = useState<ChatState[]>(cached.rewind);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const zoneId = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  useEffect(() => {
    persist(state, rewind);
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [state, rewind]);

  function pushRewind(snapshot: ChatState) {
    setRewind((current) => [...current, snapshot].slice(-MAX_REWIND_STATES));
  }

  async function sendTurn(input: { text?: string; action?: string; proposalId?: string; userLabel?: string }) {
    if (sending) return;
    const userText = input.userLabel ?? input.text?.trim() ?? "";
    if (!userText && !input.action) return;

    const before = state;
    pushRewind(before);

    const userMessage: ChatMessage | null = userText
      ? { id: crypto.randomUUID(), role: "PLAYER", text: userText }
      : null;
    const optimistic: ChatState = {
      ...before,
      messages: userMessage ? [...before.messages, userMessage].slice(-MAX_MESSAGES) : before.messages,
      suggestions: []
    };
    setState(optimistic);
    setText("");
    setSending(true);
    setError(null);

    try {
      const response = await navigatorChat({
        text: input.text,
        action: input.action,
        proposalId: input.proposalId,
        episode: before.episode,
        zoneId,
        sourceId: crypto.randomUUID()
      });
      const next = stateFromResponse(optimistic, response);
      setState(next);
      if (response.confirmed) {
        // A confirmed domain write is now canonical history. Rewinding chat may not erase it.
        setRewind([]);
        await onCanonicalChange?.();
      }
    } catch (cause) {
      setState(before);
      setRewind((current) => current.slice(0, -1));
      setError(cause instanceof Error ? cause.message : "Navigator could not process that turn.");
    } finally {
      setSending(false);
    }
  }

  function undoTurn() {
    if (sending || rewind.length === 0) return;
    const previous = rewind[rewind.length - 1];
    setState(previous);
    setRewind((current) => current.slice(0, -1));
    setError(null);
  }

  function resetConversation() {
    if (sending) return;
    const next = initialState(displayName);
    setState(next);
    setRewind([]);
    setText("");
    setError(null);
    persist(next, []);
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-emerald-300/10 bg-emerald-300/[0.02] shadow-[0_30px_80px_-48px_rgba(52,211,153,0.35)]">
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4 sm:px-6">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
            <Sparkles className="h-4 w-4 text-emerald-300" />
            Navigator
          </div>
          <p className="mt-1 text-xs text-slate-500">Conversation is transient. Confirmed, server-staged domain writes become history.</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" disabled={sending || rewind.length === 0} onClick={undoTurn} title="Rewind one unconfirmed turn">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back
          </Button>
          <Button variant="ghost" size="sm" disabled={sending} onClick={resetConversation} title="Clear the temporary Navigator conversation">
            Clear
          </Button>
        </div>
      </div>

      <div className="max-h-[52vh] min-h-[340px] space-y-5 overflow-y-auto px-5 py-6 sm:px-6">
        {state.messages.map((message) => (
          <div key={message.id} className={message.role === "PLAYER" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                message.role === "PLAYER"
                  ? "max-w-[86%] rounded-2xl rounded-br-md bg-slate-100 px-4 py-3 text-sm leading-6 text-slate-950"
                  : "max-w-[92%] rounded-2xl rounded-bl-md border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm leading-6 text-slate-300"
              }
            >
              <div className="whitespace-pre-wrap">{message.text}</div>
              {message.confirmed ? (
                <div className="mt-3 flex items-center gap-1.5 border-t border-emerald-300/10 pt-2 text-[11px] font-medium uppercase tracking-[0.13em] text-emerald-300/70">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Confirmed domain write
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {sending ? (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-slate-500">
              Understanding…
            </div>
          </div>
        ) : null}

        {!sending && state.suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2 pl-1">
            {state.suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                className={`rounded-full border px-3.5 py-2 text-xs transition-colors ${suggestionClass(suggestion.tone)}`}
                onClick={() => void sendTurn({ action: suggestion.id, proposalId: suggestion.proposalId, userLabel: suggestion.label })}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        ) : null}

        <div ref={endRef} />
      </div>

      <div className="border-t border-white/[0.06] bg-black/10 p-4 sm:p-5">
        <div className="flex items-end gap-3 rounded-2xl border border-white/[0.08] bg-black/20 p-2 focus-within:border-emerald-300/20">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (text.trim()) void sendTurn({ text: text.trim() });
              }
            }}
            placeholder="Message Navigator…"
            rows={1}
            className="max-h-32 min-h-[42px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-6 text-slate-200 outline-none placeholder:text-slate-600"
            disabled={sending}
          />
          <Button size="icon" disabled={sending || !text.trim()} onClick={() => void sendTurn({ text: text.trim() })} aria-label="Send to Navigator">
            {sending ? <CornerDownLeft className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-4 px-1">
          <p className="text-[11px] leading-4 text-slate-600">Enter sends · Shift+Enter adds a line · unconfirmed turns can be rewound</p>
          <p className="text-[11px] text-slate-700">{Math.min(state.messages.length, MAX_MESSAGES)}/{MAX_MESSAGES} cached</p>
        </div>
        {error ? <p className="mt-3 px-1 text-sm text-rose-300">{error}</p> : null}
      </div>
    </section>
  );
}
