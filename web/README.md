# Agesto — Web (Módulo Dono)

Painel analítico de gestão do Agesto. Contraparte web (visão do dono) do app
mobile action-first do agente de campo.

## Stack

- **Vite + React 19 + TypeScript**
- **Tailwind CSS v4** (config CSS-first via `@theme`) — tokens em `src/styles/tokens.css`
- **React Router** (roteamento)
- **TanStack Query** (dados de servidor)
- **MSW** (mock para desenvolvimento local sem backend)
- **Recharts** (gráficos)
- Lint: **oxlint**

## Scripts

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm run build    # type-check + build de produção
npm run lint     # oxlint
```

## Configuração

Copie `.env.example` para `.env` e ajuste:

- `VITE_API_BASE_URL` — base da API backend.
- `VITE_USE_MOCKS` — `true` usa o MSW (dev sem backend); `false` consome a API real.

## Estrutura

```
src/
  styles/tokens.css   design tokens (@theme) portados do protótipo aprovado
  lib/                cliente de API + React Query
  auth/               contexto de autenticação e rota protegida
  mocks/              MSW (handlers)
  types/              tipos TS espelhando os DTOs do backend
  components/ui/      componentes base (Card, Kpi, Pill, ...)
  layout/             AppShell (Sidebar, Topbar)
  pages/              telas (Login, Dashboard, ...)
```

## Nota de segurança (dependências)

`npm audit` reporta um advisory de **react-router** (RSC Mode CSRF, faixa
`>=7.12.0 <8.3.0`). Ele afeta apenas o **modo RSC** do React Router, que este
app **não usa** (SPA client-side declarativa). A versão fixada (7.18.2) é a mais
recente estável e corrige todos os advisories que de fato afetam SPA; ainda não
há release estável que zere o aviso do modo RSC. Risco aceito e documentado.
