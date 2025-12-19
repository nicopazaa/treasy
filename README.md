# Treasy

Treasy is a local-first training log built with Expo / React Native.

## Features

- Email-only onboarding (no password). Data stays on the device.
- Muscle blocks: Bryst, Skuldre, Rygg, Armer, Core, Cardio, Bein.
- Exercises per block, and set logging (weight + reps).
- Quick Log for fast text input (see examples below).
- Progress and rep max views.
- Treasy search: local log search, no online AI.

## Quick Log

Write a single line with exercise + sets, and Treasy will parse it:

- Benk 80x2, 70x5, 60x8
- Benkpress 80 x 2, 70 x 5
- Markloft 120kgx3

If the exercise does not exist, the app suggests creating it with one tap.

## Data Storage

All data is stored locally in AsyncStorage under the key `treasy_app_state_v2`.
There is no backend or cloud sync in this version.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the app:

   ```bash
   npm start
   ```

3. Scan the QR code with Expo Go (iOS/Android).

## Project Structure

- `App.tsx`: root component with simple navigation and state.
- `src/types`: TypeScript types for blocks, exercises, sets.
- `src/storage`: AsyncStorage load/save for app state.
- `src/services`: workout logic, quick log parsing, local search.
- `src/components`: shared UI components.
- `src/screens`: app screens (Home, Block, Exercise, Quick Log, AI, etc).

## Netlify Deployment

- Build command: `npm run build:web`
- Publish directory: `dist`
