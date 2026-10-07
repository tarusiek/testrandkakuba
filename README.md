# Ty + ja

Statyczna strona z zaproszeniem na randkę: HTML, CSS i JavaScript. Bez backendu, instalacji zależności i procesu budowania. Zachowane adresy czterech stron oraz istniejące zdjęcia.

## GitHub Pages

Umieść `index.html` oraz katalogi `sites`, `css`, `scripts`, `assets` w głównym katalogu publikowanej gałęzi. W ustawieniach repozytorium wybierz **Pages → Deploy from a branch → właściwa gałąź → / (root)**. Linki względne obsługują również publikację w podkatalogu repozytorium. Katalog `tests` jest opcjonalny przy publikacji.

## Wysyłanie

Webhook jest skonfigurowany raz, jako `WEBHOOK_URL` w `scripts/script.js`. Formularz wysyła jedną wiadomość zawierającą termin, strefę czasową, aktywność, jedzenie, sposób spotkania i opcjonalną notatkę. Początek wiadomości pozostaje w dotychczasowej formie: „Panna zdecydowała”, „Data”, „Miejsce spotkania”.

`wait=true` wymaga potwierdzenia zapisania wiadomości przez Discord. Ekran końcowy pojawia się dopiero po otrzymaniu identyfikatora wiadomości. Formularz obsługuje błędy sieci, timeout 20 s, niedostępny webhook i limit 429. Po niepotwierdzonym żądaniu nie ponawia automatycznie wysyłania, bo wiadomość mogła już dotrzeć. Podwójne kliknięcia są blokowane, a potwierdzony identyczny plan nie wysyła się ponownie w tej samej sesji.

Źródło zachowania API: [Discord — Execute Webhook](https://docs.discord.com/developers/resources/webhook#execute-webhook).

Szkic i potwierdzenie są przechowywane w `sessionStorage` danej karty. Formularz wymaga JavaScript i włączonej pamięci witryny. Godzina jest interpretowana w strefie przeglądarki, której nazwa trafia do wiadomości.

Przy bezpośrednim wysyłaniu z GitHub Pages adres webhooka jest publicznie widoczny w kodzie strony. Statyczny frontend nie może przechowywać go jako sekretu. Kod nie używa pośredników ani zewnętrznych usług formularzy.

## Weryfikacja

Otwórz `/tests/index.html` przez lokalny serwer. Testy uruchamiają rzeczywisty skrypt w izolowanych ramkach, zastępując sieć i pamięć przeglądarki kontrolowanymi odpowiednikami. Adres webhooka jest w testach zastąpiony domeną `example.invalid`. Żadna testowa wiadomość nie trafia do Discorda.

Sprawdzone: kompletność wiadomości, potwierdzenie odbioru, błędy sieci i serwera, timeout, 429, ponowna próba, duplikaty, walidacja daty, brak dostępu do pamięci i bezpośrednie wejście na ekran końcowy.

Webhook oraz odpowiedź CORS zostały sprawdzone bez publikacji wiadomości. Pełne dostarczenie na kanał należy potwierdzić przez wysłanie rzeczywistego formularza.
