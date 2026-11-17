# Agesto — Mobile (Agent App)

Agesto's field agent app: offline-first and action-first, in React Native + Expo + TypeScript, with Expo Router and local SQLite (`expo-sqlite`). The agent records and schedules atendimentos and registers clients and services without internet; sync (Carga and Descarga) sends the pending items when the connection comes back. Distributed only as an APK, outside the stores (DEC-47).

> This file replaced the default `create-expo-app` README. **Do not run `npm run reset-project`:** the template script moves `src/` and `scripts/` to `example/` and deletes the app.

## Run locally

```bash
cd mobile
npm ci
npx expo start
```

Create `mobile/.env` first:

```
EXPO_PUBLIC_API_BASE_URL=http://<your machine's IP>:5216
EXPO_PUBLIC_USE_MOCKS=false
```

- `EXPO_PUBLIC_API_BASE_URL`: API base. On the phone, use the machine's IP on the local network, not `localhost`. In release, the URL must be `https` (`src/lib/config.ts`).
- `EXPO_PUBLIC_USE_MOCKS`: `true` uses the local mocks, with no API.

The local API is described in `deploy/README.md`, section 8.

## Checks (the same as CI)

```bash
npm run lint        # expo lint
npm run typecheck   # tsc --noEmit
npm test            # jest
```

## Structure

```
src/
  app/       routes (Expo Router)
  auth/      login, session and first-access pending steps
  db/        local SQLite (source of the data on the device)
  sync/      Carga and Descarga
  features/  screens per domain
  lib/       API client and configuration
  ui/        base components
  mocks/     demo data
  types/     types mirroring the API DTOs
```

## APK and updates

APK build, OTA update (`eas update`) and new version warning: `deploy/README.md`, section 5.
