"use client"
import { Settings, Upload, Lightbulb, FileText, ArrowUp, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useRef, useState } from "react"
import { ParticleOrb } from "@/components/particle-orb"
type Message = { role: string; content: string; receipt?: Record<string, unknown> }
type Status = { runtime: { ready: boolean; jev: boolean } }
const key = "osa-aether-memory-v1"
export function ChatArea() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [provider, setProvider] = useState("auto")
  const [mode, setMode] = useState("chat")
  const [settings, setSettings] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [memoryOn, setMemoryOn] = useState(false)
  const [memory, setMemory] = useState<string[]>([])
  const [error, setError] = useState("")
  const [statusError, setStatusError] = useState(false)
  const lock = useRef(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const c = new AbortController()
    fetch("/api/cockpit", { signal: c.signal }).then(r => { if (!r.ok) throw Error(); return r.json() }).then(setStatus).catch(e => { if(e.name !== "AbortError") setStatusError(true) })
    return () => c.abort()
  }, [])
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }) }, [messages, busy])
  function toggleMemory(enabled: boolean) {
    setMemoryOn(enabled)
    if (!enabled) { setMemory([]); return }
    try { const saved = JSON.parse(localStorage.getItem(key) || "[]"); setMemory(Array.isArray(saved) ? saved.filter(x => typeof x === "string").slice(-6) : []) } catch { setMemory([]) }
  }
  function clearMemory() { setMemory([]); try { localStorage.removeItem(key) } catch {} }
  async function send() {
    const message = input.trim()
    if (lock.current || message.length < 2) return
    lock.current = true; setBusy(true); setError(""); setInput("")
    setMessages(old => [...old, { role: "user", content: message }])
    const c = new AbortController(), timer = setTimeout(() => c.abort(), 95000)
    try {
      const r = await fetch("/api/cockpit", { method: "POST", headers: { "Content-Type": "application/json" }, signal: c.signal, body: JSON.stringify({ message, provider, mode, workspace: "OSA Aether", memory: memoryOn ? memory : [] }) })
      const data = await r.json()
      if (!r.ok || !data.answer || !data.receipt) throw Error(data.error || "Nieprawidłowa odpowiedź serwera")
      setMessages(old => [...old, { role: "assistant", content: data.answer, receipt: data.receipt }])
      if (memoryOn && data.receipt.generation_status === "SUCCEEDED") {
        const next = [...memory, message].slice(-6); setMemory(next)
        try { localStorage.setItem(key, JSON.stringify(next)) } catch {}
      }
    } catch(e) { setError(e instanceof Error && e.name === "AbortError" ? "Przekroczono czas odpowiedzi." : e instanceof Error ? e.message : "Błąd połączenia"); setInput(message) }
    finally { clearTimeout(timer); lock.current = false; setBusy(false) }
  }
  function exportChat() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(messages, null, 2)], { type: "application/json" }))
    const a = document.createElement("a"); a.href = url; a.download = "osa-aether-rozmowa.json"; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const style = "btn-3d btn-glow gap-2 bg-gradient-to-br from-secondary/90 to-secondary/70 text-foreground border border-border/30 shadow-lg"
  return <main className="flex-1 flex flex-col relative overflow-hidden min-w-0">
    <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-950 to-black" />
    <div className="absolute inset-0 overflow-hidden pointer-events-none"><div className="shader-orb shader-orb-1" /><div className="shader-orb shader-orb-2" /><div className="shader-orb shader-orb-3" /></div>
    <div className="absolute inset-0 opacity-[0.15] grid-background pointer-events-none" />
    <header className="relative z-20 flex flex-wrap justify-between items-center gap-2 px-3 sm:px-6 py-4 border-b border-border/50 backdrop-blur-sm bg-background/30">
      <div className="flex items-center gap-2"><span className="font-semibold">OSA</span><select aria-label="Provider AI" value={provider} onChange={e => setProvider(e.target.value)} className="bg-secondary rounded-lg p-2 text-sm"><option value="auto">AUTO</option><option value="nvidia">NVIDIA</option><option value="openrouter">OpenRouter</option></select></div>
      <div className="flex gap-2"><Button className={style} onClick={() => setSettings(!settings)} aria-label="Ustawienia"><Settings size={16} /><span className="hidden sm:inline">Ustawienia</span></Button><Button className={style} onClick={exportChat} disabled={!messages.length} aria-label="Eksportuj rozmowę"><Upload size={16} /><span className="hidden sm:inline">Eksport</span></Button></div>
    </header>
    {settings && <section className="absolute z-30 top-20 right-3 w-[min(340px,calc(100%-24px))] rounded-2xl border border-border p-5 bg-black/95">
      <div className="flex justify-between mb-4"><h2>Ustawienia OSA</h2><button onClick={() => setSettings(false)} aria-label="Zamknij ustawienia"><X size={18} /></button></div>
      <label className="flex gap-3 text-sm"><input type="checkbox" checked={memoryOn} onChange={e => toggleMemory(e.target.checked)} />Pamiętaj 6 ostatnich wpisów</label>
      <p className="text-xs text-muted-foreground mt-2">Zapis na tym urządzeniu. Po włączeniu wpisy trafiają do modelu jako kontekst.</p>
      <Button variant="ghost" onClick={clearMemory} className="mt-3">Wyczyść pamięć</Button>
      <p className="text-xs text-muted-foreground mt-3">Tryb Agent planuje zadania. Ten runtime nie wykonuje działań w zewnętrznych aplikacjach.</p>
    </section>}
    <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-3 sm:px-6">
      {!messages.length ? <div className="min-h-full flex flex-col items-center justify-center py-8">
        <div className="mb-6"><ParticleOrb /></div><h1 className="text-2xl sm:text-4xl font-semibold mb-3 text-center font-[var(--font-heading)]">Co dziś tworzymy?</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">Twój asystent OSA. Pomysł, analiza, plan — zacznij rozmowę.</p>
        <div className="flex flex-wrap justify-center gap-2"><Button className={style} onClick={() => setInput("Pomóż mi rozwinąć pomysł: ")}><Lightbulb size={16} />Rozwiń pomysł</Button><Button className={style} onClick={() => setInput("Przygotuj konkretny plan działania dla: ")}><FileText size={16} />Ułóż plan</Button></div>
      </div> : <div className="max-w-4xl mx-auto py-6 space-y-5">
        {messages.map((m,i) => <article key={i} className={m.role === "user" ? "ml-auto max-w-[92%] rounded-2xl bg-secondary/70 p-4 border border-border/30" : "py-3"}>
          <p className="text-xs text-muted-foreground mb-2">{m.role === "user" ? "Ty" : "OSA"}</p><div className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</div>
          {m.receipt && <details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer">Ślad wykonania · {String(m.receipt.generation_status)} · {String(m.receipt.provider)}</summary><pre className="mt-2 whitespace-pre-wrap break-all">{JSON.stringify(m.receipt,null,2)}</pre></details>}
        </article>)}
        {busy && <p role="status" className="flex gap-2 text-muted-foreground"><Loader2 size={16} className="animate-spin" />OSA przygotowuje odpowiedź…</p>}<div ref={end} />
      </div>}
    </div>
    <footer className="relative z-10 px-3 sm:px-6 pb-4 pt-2"><div className="max-w-4xl mx-auto">
      <p role="status" className="text-xs text-muted-foreground mb-2">{statusError ? "Nie udało się sprawdzić runtime." : !status ? "Sprawdzam połączenie…" : status.runtime.ready ? "Provider skonfigurowany · routing " + (status.runtime.jev ? "Jev" : "lokalny") : "Dodaj klucze NVIDIA / OpenRouter w Vercelu, aby uruchomić odpowiedzi AI."}</p>
      {error && <p role="alert" className="text-red-400 text-sm mb-2">{error}</p>}
      <div className="input-3d bg-gradient-to-br from-secondary/70 via-secondary/60 to-secondary/50 backdrop-blur-xl rounded-2xl border border-border/50 p-4 shadow-2xl">
        <textarea aria-label="Wiadomość do OSA" value={input} maxLength={20000} placeholder="Napisz do OSA…" onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send() } }} className="w-full bg-transparent outline-none resize-none min-h-[60px] text-base" />
        <div className="flex justify-between items-center border-t border-border/30 pt-3"><div className="flex gap-1">{["chat","agent"].map(m => <Button key={m} size="sm" variant={mode === m ? "secondary" : "ghost"} onClick={() => setMode(m)} aria-pressed={mode === m}>{m === "chat" ? "Rozmowa" : "Agent"}</Button>)}</div>
          <Button className="btn-3d btn-glow rounded-full" size="icon" disabled={busy || input.trim().length < 2} onClick={() => void send()} aria-label="Wyślij wiadomość">{busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={20} />}</Button>
        </div>
      </div>
    </div></footer>
  </main>
}
