# Treasy

En enkel treningsapp (Expo / React Native) for logging av styrketrening, progressive overload og rask oversikt via en lokal "AI"-knapp.

## Funksjoner

- Registrering med **kun e-post** (ingen passord/PIN) – alt lagres lokalt på enheten.
- Standard blokker: **Bryst, Skuldre, Rygg, Bein**.
- Underblokker / øvelser (Benkpress, Militærpress, Knebøy, Markløft, osv.).
- Logg sett med vekt og reps per øvelse.
- "Treasy AI":
  - Lokal logikk, ingen ekte LLM.
  - Kan svare på spørsmål som: _"Hva tok jeg sist i benkpress?"_ basert på loggen din.

## Kom i gang

1. Installer avhengigheter:

   ```bash
   npm install
   ```

2. Start appen:

   ```bash
   npx expo start
   ```

3. Skann QR-koden med Expo Go-appen på telefonen din (iOS/Android) for å teste Treasy.

## Strukur

- `App.tsx` – root med enkel navigation / state.
- `src/types` – TypeScript-typer for blokker, øvelser, sett, osv.
- `src/storage` – lasting og lagring av app-state med AsyncStorage.
- `src/services` – logikk for å legge til øvelser, logge sett og hente siste sett.
- `src/components` – gjenbrukbare UI-komponenter (knapper, inputs).
- `src/screens` – skjermer: Welcome, Home, Block, Exercise, AI.

## Viktig

- Dette er en **lokal** app. Data synkes ikke mellom enheter.
- Hvis du reinstalerer appen eller bytter telefon, vil loggen forsvinne i denne versjonen.