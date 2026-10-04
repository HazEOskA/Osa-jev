# Osa-jev — Agent Console (Figma 1:1)

## Struktura

- `app/(console)/` — layout i strona główna konsoli
- `components/console/` — Sidebar, ChatPanel, WorkerPanel, PromptInput, StatusBadge
- `lib/workers/` — eventBus, Hermes, JEV, Cline, typy

## Integracja workerów

1. Podmień mockowe implementacje w `lib/workers/*.ts` na realne połączenia (WebSocket / REST).
2. Użyj `eventBus` do subskrypcji zdarzeń w UI.
3. Dostosuj kolory w `styles/globals.css` do finalnej wersji z Figmy.

## Uruchomienie

```bash
npm install
npm run dev
```

Otwórz `http://localhost:3000`.
