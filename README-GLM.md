# OSA JEFF × GLM Chat V1 — moduł addytywny

## Cel

Nowy czat ChatGPT-style po polsku, z modelem Experiential Labs i streamingiem SSE.
Bez zmian w istniejącym UI OSA Jeff (`/`), istniejącym runtime (`/api/cockpit`), innych repo ani produkcji.
Nowy interfejs pod `/glm`, backend `/api/glm-chat`.

## Instalacja

1. Skopiuj zawartość katalogów `app/`, `components/`, `lib/`, `tests/` do tych samych ścieżek repo `HazEOskA/Osa-jev`.
2. Dodaj wartości z `.env.glm.example` do **sekretów serwerowych**; na lokalnym środowisku użyj `.env.local` (nie commituj).
3. `npm test` nie istnieje w repo; uruchom `node --test tests/*.test.cjs`.
4. `npm run build` w repo z zainstalowanymi paczkami.
5. Lokalnie `npm run dev`, otwórz `/glm`, wprowadź osobny `JEFF_CHAT_ACCESS_TOKEN` i rozpocznij rozmowę.
6. Dopiero po zatwierdzeniu może powstać PR i opcjonalnie Vercel Preview. Nie wykonuj automatycznego deployu na produkcję.

## Bezpieczeństwo / koszty

- `EXPLABS_API_KEY` pozostaje w backendzie. Brak tokenu `JEFF_CHAT_ACCESS_TOKEN` blokuje wywołania.
- Nie ma automatycznego testu płatnej inferencji ani automatycznych żądań przy ładowaniu strony.
- GLM jest modelem płatnym; przy obecnych publicznych stawkach ~$0.15 za 1M input i ~$0.50 za 1M output (możliwe opłaty zależne od konta).
- Samodzielny token dostępu jest tymczasowym zabezpieczeniem v1, nie zastępuje enterprise SSO, per-user quotas, audit logs i idempotencji.
- Historia jest lokalna w `localStorage` tej przeglądarki, nie synchronizuje się między urządzeniami; dane nie są szyfrowane w spoczynku.
- To czat z modelem, nie agent z narzędziami mogącymi zmieniać repo lub wykonywać kod.

## Zakres i ograniczenia

Obecne: polski responsive chat, wiele konwersacji, nowe/zmiana nazwy/usuwanie, eksport JSON, streaming z zatrzymaniem, retry, blok kodu i kopiowanie, bezpieczny proxy i walidacja.
Nieimplementowane: pliki, obrazy, voice, przeglądanie sieci, narzędzia wykonywalne, centralna baza historii, SSO i pełna kompatybilność funkcji ChatGPT.

## Weryfikacja

- Testy jednostkowe i integracyjne endpointu na mockowanym API: 10/10 PASS (lokalnie bez sieci).
- Kontrola poprawności składni TypeScript/TSX: 3/3 PASS (transpileModule).
- Build Next.js: UNKNOWN, wymaga pełnego checkoutu istniejącego repo i dependencies.
- E2E Experiential: UNKNOWN, wymaga autoryzowanego klucza i zgody na potencjalny koszt.
- Preview / Production: NIE WDROŻONO.