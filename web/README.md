# Agesto — Web (Dono Module)

Agesto's analytical management panel. The web counterpart (owner's view) of the
field agent's action-first mobile app.

## Stack

- **Vite + React 19 + TypeScript**
- **Tailwind CSS v4** (CSS-first config via `@theme`) — tokens in `src/styles/tokens.css`
- **React Router** (routing)
- **TanStack Query** (server data)
- **MSW** (mocks for local development without a backend)
- **Recharts** (charts)
- Lint: **oxlint**

## Scripts

```bash
npm install
npm run dev      # development server
npm run build    # type-check + production build
npm run lint     # oxlint
npm test         # vitest (CI runs lint, tests and build)
```

## Configuration

Copy `.env.example` to `.env.local` and adjust:

- `VITE_API_BASE_URL` — backend API base. The local API runs at `http://localhost:5216` (`deploy/README.md`, section 8).
- `VITE_USE_MOCKS` — `true` uses MSW (dev without a backend); `false` consumes the real API.

In demo mode (`VITE_USE_MOCKS=true`), the example logins are already filled in at `/login` and at `/admin/login`.

## Structure

```
src/
  styles/tokens.css   design tokens (@theme) ported from the approved prototype
  lib/                API client + React Query
  auth/               authentication context and protected route
  mocks/              MSW (handlers)
  types/              TS types mirroring the backend DTOs
  components/ui/      base components (Card, Kpi, Pill, ...)
  layout/             AppShell (Sidebar, Topbar)
  pages/              screens (Login, Dashboard, ...)
  features/           screens per domain (clientes, agenda, usuarios, ...)
  admin/              Agesto team's superadmin area (/admin, DEC-52)
  theme/              palettes and light/dark theme
  test/               Vitest setup
```

## Security note (dependencies)

`npm audit` reports a **react-router** advisory (RSC Mode CSRF, range
`>=7.12.0 <8.3.0`). It only affects React Router's **RSC mode**, which this
app **does not use** (declarative client-side SPA). The version in use (7.18.5) is the
latest stable and fixes every advisory that actually affects an SPA; there is no
stable release yet that clears the RSC mode warning. Risk accepted and documented.
