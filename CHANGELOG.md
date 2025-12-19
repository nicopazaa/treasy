# Changelog

- Guest-first onboarding: “Continue without login” is the default path.
- Optional login entrypoint: GitHub (web) + Email (local identity).
- GitHub OAuth exchange via Netlify Function (`netlify/functions/github-oauth.js`).
- Language setting: English / Norwegian / Spanish (stored in app state).
- Quick Log always saves free text; parses sets when possible.
- New exercise flow: saves first, then optional muscle-group picker (bottom sheet).
- Home screen reworked: Quick Log first, then muscle groups, then insight cards.
- History groups repeated sets by exercise (no repeated exercise names).
- Removed visible edit/delete actions; long-press opens actions for exercises and sets.
- Updated Netlify config to include functions directory.
