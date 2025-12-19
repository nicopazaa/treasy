# Treasy

Treasy is a local-first training log built with Expo / React Native (web + mobile).

## Core idea

Log training like Notes:

- Write freely
- Treasy always saves the text
- Treasy extracts structure when possible (exercise + sets + timestamp)

## Onboarding

- **Continue without login (default):** data stays on the device (can be lost if the device is lost)
- **Log in (optional):**
  - GitHub (web) via Netlify Function OAuth
  - Email (local-only identity in this version)

## Quick log examples

- Benk 80x2, 70x5, 60x8
- Benkpress 80 x 2, 70 x 5
- Markløft 120kgx3

If Treasy finds a new exercise name, it saves first, then asks for a muscle group (optional). If you dismiss it, the exercise stays uncategorized.

## Data storage

All data is stored locally in AsyncStorage under the key `treasy_app_state_v2`:

- Blocks, exercises, sets
- Free-text logs
- Profile settings + language

There is no cloud sync of workouts in this version.

## Run locally

1. Install deps: `npm install`
2. Start: `npm start`

If PowerShell blocks `npm`, use: `npm.cmd start`

Useful scripts:

- `npm run web`
- `npm run ios`
- `npm run android`
- `npm run build:web` (exports to `dist`)

## Netlify

- Build command: `npm run build:web`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

### GitHub login env vars (Netlify)

Set these environment variables:

- `EXPO_PUBLIC_GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

Callback URL to add in your GitHub OAuth App:

- `https://<your-site>.netlify.app/auth/github`
