# OSA Aether + Jev

Integracja interfejsu Aether z runtime przeniesionym z HazEOskA/IFB-AI-LAB.
Zachowany motyw, animowana kula, polski czat, AUTO/NVIDIA/OpenRouter, routing Jev,
tryb rozmowy/agenta, lokalna pamięć opt-in oraz eksport rozmowy wraz z receipts.

## Start

```bash
npm install --legacy-peer-deps
cp .env.example .env.local
npm run dev
```

## Vercel

Wdróż ten katalog jako projekt Next.js. Dodaj OPENROUTER_API_KEY oraz
NVIDIA_API_KEY w Environment Variables i wykonaj nowe wdrożenie.
Klucze występują wyłącznie po stronie serwera — bez prefiksu NEXT_PUBLIC.
GET /api/cockpit pokazuje konfigurację; POST /api/cockpit obsługuje rozmowę.
Sama obecność klucza nie potwierdza poprawności konta ani odpowiedzi modelu.

## Weryfikacja

```bash
node --test tests/runtime.test.cjs
npx tsc --noEmit
npm run build
```

Receipts zawierają generation_status: SUCCEEDED / FAILED / NOT_CONFIGURED.
EXECUTION_RECORDED oznacza zapis śladu, nie niezależny dowód prawdziwości odpowiedzi.
Routing bez Jev jest jawnie oznaczony jako fallback.
Tryb Agent planuje i tworzy odpowiedzi; nie wykonuje działań zewnętrznych.
Pamięć to maksymalnie 6 wpisów użytkownika na urządzeniu, domyślnie wyłączona.

## Zakres kolejnego etapu

Android, głos, generowanie dowolnych postaci 3D i AR nie są zaimplementowane.
Animowana kula pochodzi z dostarczonego szablonu.
Przed udostępnieniem płatnego API publicznie potrzebne są uwierzytelnienie
i limity użycia dostosowane do docelowego produktu.
