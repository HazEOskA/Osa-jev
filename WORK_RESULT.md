# Integracja agent-chat z Osa-jev

Cel: dostarczony polski interfejs czatu korzysta z istniejącego GET/POST /api/cockpit, bez tworzenia nowego backendu.
Baza: main, 3ffc7266bfe0fac54dfafc62ee592775c9981a66.
Status: integracja zatwierdzona do commitu i pushu na feature/agent-chat-cockpit-integration. Bez merge i ręcznego deploymentu.

## Zmiany
- Port interfejsu React/Vite do klienta istniejącej aplikacji Next.js pod /.
- CockpitAdapter zamiast MockAdapter. Jeden POST na wiadomość; odpowiedź JSON bez symulowanego streamingu.
- Mapowanie Auto/NVIDIA/OpenRouter na provider backendu. Modele wybierane przez serwer.
- Lokalna historia rozmów w pamięci sesji; do backendu trafia do sześciu wcześniejszych wpisów użytkownika danej rozmowy.
- Retry, błędy sieci, brak konfiguracji i przerwanie oczekiwania. Stop nie potwierdza zatrzymania pracy serwera.
- Receipt z rzeczywistym execution_id i treścią zwróconą przez backend. Status recorded; EXECUTION_RECORDED nie jest zweryfikowanym dowodem APR.
- Hermes/APR/Monitoring: niepotwierdzone. Status konfiguracji kluczy nie jest testem dostępności usług.
- Załączniki niedostępne; klucze providerów pozostają po stronie backendu.
- Usunięte pięć zależności native/Expo i zaktualizowany istniejący lockfile; dodane react-markdown/remark-gfm.
- Usunięte dwa pliki starej grupy console mapującej się na tę samą trasę /; główna trasa obsługuje dostarczony czat. Stare komponenty i backend zachowane.

## Weryfikacja
- npm ci --ignore-scripts: PASS bez force/legacy-peer-deps.
- npx tsc --noEmit: PASS, niezależnie od istniejącego ignoreBuildErrors.
- 6 istniejących testów runtime + 3 testy adaptera: PASS.
- Build produkcyjny: PASS z NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1. Bez tej zmiennej środowisko lokalne nie pobiera istniejących Google Fonts przez TLS. Konfiguracja projektu niezmieniona.
- HTTP GET /, GET /api/cockpit i POST /api/cockpit: PASS na lokalnym serwerze produkcyjnym; bez kluczy POST zwraca NOT_CONFIGURED i receipt EXECUTION_RECORDED.
- Desktop/mobile/screenshoty: BLOCKED, Work zwrócił ERR_BLOCKED_BY_CLIENT dla localhost; pobranie Chromium nie dostarczyło poprawnego archiwum. Brak potwierdzenia wizualnego.
- Realna odpowiedź modelu: UNKNOWN, brak kluczy w lokalnym środowisku. Backend nie został zmieniony.

## Następny krok
Przed uruchomieniem produkcyjnym sprawdzić wizualnie desktop/mobile i realną odpowiedź modelu w środowisku z kluczami.
