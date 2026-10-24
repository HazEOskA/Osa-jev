"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { FormEvent } from "react"
import {
  ArrowUp, Check, ChevronLeft, Clipboard, Code2, Download, KeyRound,
  Menu, MessageSquare, Pencil, Plus, ShieldCheck, Square, Trash2, X,
} from "lucide-react"

type Role = "user" | "assistant"
type Message = { id: string; role: Role; content: string; at: number }
type Conversation = { id: string; title: string; created: number; modified: number; messages: Message[] }
const STORAGE_KEY = "osa-jeff-glm-conversations-v1"
const ACTIVE_KEY = "osa-jeff-glm-active-v1"
const ID = () => crypto.randomUUID()
const newConversation = (): Conversation => ({ id: ID(), title: "Nowa rozmowa", created: Date.now(), modified: Date.now(), messages: [] })

function load(): Conversation[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
    if (!Array.isArray(parsed)) return []
    return parsed.filter((c): c is Conversation => Boolean(c && typeof c === "object" && typeof c.id === "string" && typeof c.title === "string" && Array.isArray(c.messages)))
      .slice(0, 30).map(c => ({ ...c, messages: c.messages.filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string" && m.content.length <= 20000).slice(-80) }))
  } catch { return [] }
}

function Inline({ text }: { text: string }) {
  const tokens = text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g)
  return <>{tokens.map((t, i) => t.startsWith("**") && t.endsWith("**")
    ? <strong key={i} className="font-semibold text-white">{t.slice(2, -2)}</strong>
    : t.startsWith("`") && t.endsWith("`")
      ? <code key={i} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.88em] text-cyan-200">{t.slice(1, -1)}</code>
      : <span key={i}>{t}</span>)}</>
}

function Markdown({ content }: { content: string }) {
  const sections = content.split(/(```[^\n]*\n[\s\S]*?```)/g)
  return <div className="min-w-0 space-y-3 text-[15px] leading-7 text-zinc-100">
    {sections.map((section, si) => {
      if (section.startsWith("```") && section.endsWith("```")) {
        const first = section.indexOf("\n")
        const language = section.slice(3, first).trim()
        const code = section.slice(first + 1, -3).replace(/\n$/, "")
        return <div key={si} className="overflow-hidden rounded-xl border border-white/10 bg-[#111318]">
          <div className="flex items-center justify-between border-b border-white/10 bg-[#1c1e25] px-3 py-2 text-xs text-zinc-400"><span>{language || "kod"}</span><button className="flex items-center gap-1.5 hover:text-white" onClick={() => void navigator.clipboard.writeText(code)} aria-label="Kopiuj kod"><Clipboard size={13} /> Kopiuj</button></div>
          <pre className="overflow-x-auto p-4 text-[13px] leading-6 text-zinc-100"><code>{code}</code></pre>
        </div>
      }
      return section.split("\n").map((line, li) => {
        const heading = line.match(/^(#{1,3})\s+(.+)$/)
        if (heading) return <div key={`${si}-${li}`} className={`${heading[1].length === 1 ? "text-xl" : "text-lg"} mt-3 font-bold`}><Inline text={heading[2]} /></div>
        const list = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/)
        if (list) return <div key={`${si}-${li}`} className="flex gap-2 pl-2"><span className="text-violet-400">•</span><div><Inline text={list[1]} /></div></div>
        if (!line.trim()) return <div key={`${si}-${li}`} className="h-2" />
        return <div key={`${si}-${li}`} className="whitespace-pre-wrap break-words"><Inline text={line} /></div>
      })
    })}
  </div>
}

function parseDelta(frame: string): { text: string; done: boolean } {
  const parts = frame.split("\n").filter(x => x.startsWith("data:")).map(x => x.slice(5).trimStart())
  let text = "", done = false
  for (const data of parts) {
    if (data.trim() === "[DONE]") { done = true; continue }
    try {
      const item = JSON.parse(data)
      if (item.error) throw Error("Dostawca zwrócił błąd w trakcie generowania.")
      const delta = item.choices?.[0]?.delta?.content
      if (typeof delta === "string") text += delta
      if (Array.isArray(delta)) for (const d of delta) if (typeof d?.text === "string") text += d.text
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Dostawca")) throw err
    }
  }
  return { text, done }
}

export function GlmChat() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState("")
  const [ready, setReady] = useState(false)
  const [sidebar, setSidebar] = useState(false)
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [token, setToken] = useState("")
  const [secretInput, setSecretInput] = useState("")
  const [credentialsOpen, setCredentialsOpen] = useState(true)
  const controller = useRef<AbortController | null>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const conversation = useMemo(() => conversations.find(c => c.id === activeId), [conversations, activeId])
  const lock = useRef(false)

  useEffect(() => {
    const saved = load()
    const first = saved.length ? saved : [newConversation()]
    const last = localStorage.getItem(ACTIVE_KEY)
    setConversations(first)
    setActiveId(last && first.some(c => c.id === last) ? last : first[0].id)
    setReady(true)
  }, [])
  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, 30))); localStorage.setItem(ACTIVE_KEY, activeId) }
      catch { setError("Brak miejsca w pamięci przeglądarki. Wyeksportuj historię rozmowy.") }
    }, 450)
    return () => clearTimeout(timer)
  }, [conversations, activeId, ready])
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end", behavior: busy ? "instant" : "smooth" }) }, [conversation?.messages, busy])

  function createChat() {
    if (busy) return
    const chat = newConversation()
    setConversations(old => [chat, ...old].slice(0, 30))
    setActiveId(chat.id)
    setInput("")
    setError("")
    setSidebar(false)
    inputRef.current?.focus()
  }
  function removeChat(id: string) {
    if (busy || !window.confirm("Usunąć tę rozmowę z tego urządzenia?")) return
    const others = conversations.filter(c => c.id !== id)
    const remaining = others.length ? others : [newConversation()]
    setConversations(remaining)
    if (id === activeId) setActiveId(remaining[0].id)
  }
  function renameChat(id: string) {
    const current = conversations.find(c => c.id === id)
    if (!current || busy) return
    const name = window.prompt("Nowa nazwa rozmowy", current.title)?.trim()
    if (name) setConversations(old => old.map(c => c.id === id ? { ...c, title: name.slice(0, 80) } : c))
  }
  function downloadChat() {
    if (!conversation) return
    const blob = new Blob([JSON.stringify(conversation, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `osa-jeff-${conversation.id.slice(0, 8)}.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function modify(id: string, change: (c: Conversation) => Conversation) {
    setConversations(old => old.map(c => c.id === id ? change(c) : c))
  }
  async function send(retry = false) {
    if (lock.current || !token || !conversation) { if (!token) setCredentialsOpen(true); return }
    const text = input.trim()
    const lastUser = [...conversation.messages].reverse().find(m => m.role === "user")
    if ((!retry && text.length < 2) || (retry && !lastUser)) return
    const history = retry
      ? conversation.messages.slice(0, conversation.messages.findLastIndex(m => m.role === "user") + 1)
      : [...conversation.messages, { id: ID(), role: "user" as const, content: text.slice(0, 20000), at: Date.now() }]
    const id = conversation.id
    const assistantId = ID()
    lock.current = true
    setBusy(true)
    setError("")
    if (!retry) setInput("")
    modify(id, c => ({ ...c, title: c.messages.length ? c.title : text.slice(0, 60), modified: Date.now(), messages: [...history, { id: assistantId, role: "assistant", content: "", at: Date.now() }] }))
    const abort = new AbortController()
    controller.current = abort
    let responseText = ""
    let finished = false
    try {
      const response = await fetch("/api/glm-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ messages: history.slice(-40).map(m => ({ role: m.role, content: m.content.slice(0, 20000) })) }),
        signal: abort.signal,
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || `Błąd HTTP ${response.status}`)
      }
      if (!response.body) throw Error("Serwer nie zwrócił strumienia.")
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (!finished) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n")
        let cut: number
        while ((cut = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, cut)
          buffer = buffer.slice(cut + 2)
          const delta = parseDelta(frame)
          if (delta.text) {
            responseText += delta.text
            modify(id, c => ({ ...c, modified: Date.now(), messages: c.messages.map(m => m.id === assistantId ? { ...m, content: responseText } : m) }))
          }
          if (delta.done) { finished = true; break }
        }
      }
      if (!finished) throw Error("Strumień zakończył się bez potwierdzenia [DONE].")
      if (!responseText.trim()) throw Error("Model nie zwrócił treści odpowiedzi.")
    } catch (e) {
      const cancelled = abort.signal.aborted
      setError(cancelled ? "Generowanie zatrzymane." : e instanceof Error ? e.message : "Błąd połączenia.")
      if (!responseText) modify(id, c => ({ ...c, messages: c.messages.filter(m => m.id !== assistantId) }))
    } finally {
      controller.current = null
      lock.current = false
      setBusy(false)
      inputRef.current?.focus()
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); void send() }

  return <div className="flex h-dvh min-h-[400px] overflow-hidden bg-[#0d0e12] text-zinc-100 antialiased">
    {sidebar && <button className="fixed inset-0 z-30 bg-black/70 lg:hidden" aria-label="Zamknij panel rozmów" onClick={() => setSidebar(false)} />}
    <aside className={`${sidebar ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex w-[286px] flex-col border-r border-white/10 bg-[#15161c] transition-transform lg:static lg:translate-x-0`}>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-2 font-semibold tracking-wide"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-400"><Code2 size={18}/></span> OSA JEFF</div>
        <button className="lg:hidden" onClick={() => setSidebar(false)} aria-label="Zamknij"><X size={20}/></button>
      </div>
      <button onClick={createChat} className="mx-3 mt-4 flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-medium transition hover:bg-white/15"><Plus size={17}/> Nowy czat</button>
      <div className="px-5 pb-2 pt-6 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Twoje rozmowy</div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-5" aria-label="Historia rozmów">
        {conversations.map(c => <div key={c.id} className={`group flex items-center rounded-xl ${c.id === activeId ? "bg-[#2a2c36]" : "hover:bg-white/5"}`}>
          <button onClick={() => { if (!busy) { setActiveId(c.id); setError(""); setSidebar(false) } }} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-left text-sm"><MessageSquare className="shrink-0 text-zinc-500" size={16}/><span className="truncate">{c.title}</span></button>
          <button aria-label={`Zmień nazwę ${c.title}`} title="Zmień nazwę" className="px-1.5 py-2 text-zinc-500 hover:text-white" onClick={() => renameChat(c.id)}><Pencil size={13}/></button>
          <button aria-label={`Usuń ${c.title}`} title="Usuń" className="pr-3 pl-1.5 py-2 text-zinc-500 hover:text-rose-400" onClick={() => removeChat(c.id)}><Trash2 size={13}/></button>
        </div>)}
      </nav>
      <div className="border-t border-white/10 p-4 text-xs leading-5 text-zinc-400"><div className="mb-2 flex items-center gap-2 text-zinc-200"><ShieldCheck size={15}/> Historia na tym urządzeniu</div>Klucz API pozostaje na serwerze. Token dostępu tylko w pamięci otwartej strony.</div>
    </aside>

    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-[66px] shrink-0 items-center justify-between border-b border-white/10 px-4 sm:px-7">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebar(true)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 lg:hidden" aria-label="Otwórz historię"><Menu size={21}/></button>
          <div><div className="font-semibold tracking-tight">OSA Jeff <span className="font-normal text-zinc-500">/ GLM Chat</span></div><div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/> GLM 5.3 Flash Uncensored</div></div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button onClick={downloadChat} title="Eksport rozmowy" aria-label="Eksport rozmowy" className="rounded-xl p-2.5 text-zinc-400 hover:bg-white/10 hover:text-white"><Download size={18}/></button>
          <button onClick={() => setCredentialsOpen(true)} title="Dostęp" aria-label="Ustaw token dostępu" className="rounded-xl p-2.5 text-zinc-400 hover:bg-white/10 hover:text-white"><KeyRound size={18}/></button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-3 sm:px-6" aria-label="Wiadomości">
        {!conversation?.messages.length ? <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center gap-4 pb-24 text-center">
          <div className="mb-1 grid h-16 w-16 place-items-center rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-600/25 to-indigo-600/10 shadow-[0_0_50px_#7c3aed22]"><Code2 className="text-violet-300" size={30}/></div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Co dziś zbudujemy?</h1>
          <p className="max-w-md text-sm leading-6 text-zinc-400">Twój czat AI OSA Jeff. Projektowanie, kod, analiza i rozmowa z GLM 5.3.</p>
          <div className="mt-5 grid w-full max-w-xl gap-2 sm:grid-cols-2">
            {["Zaprojektuj architekturę systemu agentowego", "Wyjaśnij fragment kodu TypeScript", "Przygotuj konkretny plan wdrożenia", "Zrób code review mojego pomysłu"].map(p => <button key={p} onClick={() => { setInput(p); inputRef.current?.focus() }} className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-left text-xs text-zinc-300 transition hover:border-violet-500/50 hover:bg-white/[0.07]">{p} <span className="float-right text-violet-300">↗</span></button>)}
          </div>
        </div> : <div className="mx-auto max-w-3xl space-y-7 py-8">
          {conversation.messages.map(m => <article key={m.id} className={`${m.role === "user" ? "ml-auto max-w-[90%] rounded-2xl rounded-br-md border border-white/10 bg-[#242630] px-4 py-3 sm:max-w-[80%]" : "w-full py-2"}`}>
            {m.role === "assistant" && <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-violet-300"><span className="grid h-6 w-6 place-items-center rounded-lg bg-violet-700/25"><Code2 size={13}/></span> OSA Jeff</div>}
            {m.content ? <Markdown content={m.content} /> : <div className="flex gap-1 py-2"><span className="h-2 w-2 animate-pulse rounded-full bg-violet-300"/><span className="h-2 w-2 animate-pulse rounded-full bg-violet-300 [animation-delay:160ms]"/><span className="h-2 w-2 animate-pulse rounded-full bg-violet-300 [animation-delay:300ms]"/></div>}
            {m.role === "assistant" && m.content && <div className="mt-3 flex gap-3 text-zinc-500"><button className="flex items-center gap-1 text-xs hover:text-white" aria-label="Kopiuj odpowiedź" onClick={() => void navigator.clipboard.writeText(m.content)}><Clipboard size={14}/> Kopiuj</button></div>}
          </article>)}
          <div ref={bottom} />
        </div>}
      </main>
      <footer className="shrink-0 bg-gradient-to-t from-[#0d0e12] via-[#0d0e12] to-transparent px-3 pb-4 pt-2 sm:px-6 sm:pb-6">
        <div className="mx-auto max-w-3xl">
          {error && <div role="alert" className="mb-2 rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-2.5 text-sm text-rose-200">{error}</div>}
          <form onSubmit={submit} className="rounded-2xl border border-white/15 bg-[#242630] p-3 shadow-2xl focus-within:border-violet-500/50">
            <textarea ref={inputRef} aria-label="Napisz do OSA Jeff" placeholder="Napisz do OSA Jeff…" rows={2} maxLength={20000} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send() } }} className="max-h-48 min-h-12 w-full resize-y bg-transparent px-2 pt-1 text-[15px] text-zinc-100 outline-none placeholder:text-zinc-500" />
            <div className="flex items-center justify-between pt-2"><span className="pl-2 text-[11px] text-zinc-500">Shift + Enter — nowa linia</span><div className="flex items-center gap-2">{!busy && conversation?.messages.at(-1)?.role === "assistant" && <button type="button" onClick={() => void send(true)} className="rounded-lg px-2 py-1 text-xs text-zinc-400 hover:text-white">Ponów</button>}{busy ? <button type="button" onClick={() => controller.current?.abort()} className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-100 text-zinc-950" aria-label="Zatrzymaj generowanie"><Square size={14} fill="currentColor" /></button> : <button type="submit" disabled={input.trim().length < 2} className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500 text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-30" aria-label="Wyślij wiadomość"><ArrowUp size={19}/></button>}</div></div>
          </form>
          <p className="pt-2 text-center text-[11px] text-zinc-600">OSA Jeff może popełniać błędy. Odpowiedzi pochodzą z modelu zewnętrznego.</p>
        </div>
      </footer>
    </section>

    {credentialsOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Token dostępu do OSA Jeff">
      <form onSubmit={e => { e.preventDefault(); if (secretInput.trim().length >= 16) { setToken(secretInput.trim()); setSecretInput(""); setCredentialsOpen(false) } }} className="w-full max-w-md rounded-2xl border border-white/15 bg-[#202129] p-6 shadow-2xl">
        <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-lg font-semibold"><KeyRound size={21} className="text-violet-300" /> Prywatny dostęp</div>{token && <button type="button" aria-label="Zamknij" onClick={() => setCredentialsOpen(false)}><X size={18}/></button>}</div>
        <p className="mb-5 text-sm leading-6 text-zinc-400">Wprowadź token ustawiony po stronie serwera jako <code className="text-violet-200">JEFF_CHAT_ACCESS_TOKEN</code>. Token zostaje wyłącznie w pamięci bieżącej karty i nie jest zapisywany w historii.</p>
        <input type="password" autoComplete="off" minLength={16} required placeholder="Token dostępu" value={secretInput} onChange={e => setSecretInput(e.target.value)} className="w-full rounded-xl border border-white/15 bg-black/30 p-3 text-sm outline-none focus:border-violet-400" />
        <div className="mt-4 flex gap-2"><button type="submit" className="flex-1 rounded-xl bg-violet-600 px-4 py-3 text-sm font-medium hover:bg-violet-500">Otwórz czat</button>{token && <button type="button" className="rounded-xl border border-white/15 px-4 text-sm" onClick={() => { setToken(""); setSecretInput("") }}>Wyloguj</button>}</div>
      </form>
    </div>}
  </div>
}