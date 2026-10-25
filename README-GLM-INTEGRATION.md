# OSA Jeff × GLM — integracja z interfejsem „Przestrzeń AI”

Baza: `feature/agent-chat-cockpit-integration` (`bbf3cdd`). Główny UI `/` i jego CSS pozostają niezmienione.

## Przepływ
- W już istniejącym selektorze „Wybierz model” wybierz `GLM 5.3`.
- `Ustawienia → Klucze API`: wpisz token dostępu OSA Jeff. Token jest przechowywany jedynie w stanie aplikacji (nie w localStorage).
- `CockpitAdapter` przesyła pełną historię wiadomości użytkownika/asystenta (maks. 40) do `/api/glm-chat`.
- Endpoint wykorzystuje serwerowy `EXPLABS_API_KEY` do streamingu SSE Experiential Labs. Parser jest odporny na podział pakietów; brak `[DONE]` oznacza błąd, a nie sukces.
- Auto/NVIDIA/OpenRouter pozostają na dotychczasowym `/api/cockpit`. Bezpośrednie połączenia przeglądarka → Experiential Labs są zabronione.
- GLM nie tworzy sztucznego APR ProofReceipt. Status wykonania oznacza jedynie zakończenie streamu.

## Zmienne Vercel Preview
W projekcie `osa-jev` i Preview muszą być ustawione:
`EXPLABS_API_KEY`, `JEFF_CHAT_ACCESS_TOKEN` (minimum 16 znaków), opcjonalnie `EXPLABS_MODEL`, `EXPLABS_MAX_OUTPUT_TOKENS`.
Nie kopiować sekretów z Production do logów lub repozytorium. Brak konfiguracji skutkuje fail-closed.

## Testy / akceptacja
`node --test tests/glm-sse.test.cjs tests/glm-chat-core.test.cjs tests/glm-route.test.cjs`
Następnie build Vercel Preview, ręczny test desktop/mobile, test wiadomości w polskim UI, status błędów i brak regresji NVIDIA/OpenRouter. Żadnych operacji na Production bez osobnej zgody.
