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


## Dynamiczny katalog modeli (OSA Jeff)
Po zalogowaniu kliknij selektor obok pola wiadomości. Katalog standardowych modeli tekstowych jest pobierany z `/api/models` z Experiential Labs, NVIDIA i OpenRouter, jeżeli ich klucze istnieją w środowisku serwera. Dostęp do katalogu nie potwierdza dostępu do inferencji. Ceny są podawane tylko jeśli dostawca zwraca `pricing.prompt` i `pricing.completion` w USD/token. Nieznana cena nie oznacza modelu darmowego. Wybór jest zapamiętany lokalnie (bez kluczy). Wszystkie wybrane modele korzystają z chronionego `/api/glm-chat` i SSE; historia obejmuje do 40 zakończonych wiadomości. Dotychczasowy model domyślny i sesja pozostają bez zmian. Brak automatycznego przełączania między dostawcami.

Selektor na telefonie otwiera się w osobnym przewijanym oknie. Istniejąca ważna sesja działa również przy braku opcjonalnych nagłówków GET. Jeżeli sesja wygasła, można ją odnowić z poziomu selektora za pomocą dotychczasowego tokenu OSA Jeff; klucze dostawców pozostają na serwerze.

Publiczne katalogi dostawców są dostępne bez sesji (bez wysyłania kluczy); nie oznaczają dostępu konta do inferencji. Po aktywacji sesji katalog jest pobierany z kluczami konta, a czat nadal wymaga autoryzacji. Puste wyniki wyszukiwania i błędy dostawców są wyświetlane osobno.
