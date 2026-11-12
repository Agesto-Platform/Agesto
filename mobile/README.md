# Agesto — Mobile (App do Agente)

App do agente de campo do Agesto: offline-first e action-first, em React Native + Expo + TypeScript, com Expo Router e SQLite local (`expo-sqlite`). O agente registra e agenda atendimentos, cadastra clientes e serviços sem internet; a sincronização (Carga e Descarga) envia as pendências quando a conexão volta. Distribuído só como APK, fora das lojas (DEC-47).

> Este arquivo substituiu o README padrão do `create-expo-app`. **Não rode `npm run reset-project`:** o script do template move `src/` e `scripts/` para `example/` e apaga o app.

## Rodar localmente

```bash
cd mobile
npm ci
npx expo start
```

Crie `mobile/.env` antes:

```
EXPO_PUBLIC_API_BASE_URL=http://<IP da sua máquina>:5216
EXPO_PUBLIC_USE_MOCKS=false
```

- `EXPO_PUBLIC_API_BASE_URL`: base da API. No celular, use o IP da máquina na rede local, não `localhost`. Em release, a URL precisa ser `https` (`src/lib/config.ts`).
- `EXPO_PUBLIC_USE_MOCKS`: `true` usa os mocks locais, sem API.

A API local está em `deploy/README.md`, seção 8.

## Verificações (as mesmas do CI)

```bash
npm run lint        # expo lint
npm run typecheck   # tsc --noEmit
npm test            # jest
```

Testes de componente usam `@testing-library/react-native` v14: `render`, `fireEvent` e `userEvent` são assíncronos, então sempre com `await`. Exemplos em `src/ui/componentes.test.tsx` e `src/features/atendimentos/AtendimentosTela.test.tsx`.

## Estrutura

```
src/
  app/       rotas (Expo Router)
  auth/      login, sessão e pendências do primeiro acesso
  db/        SQLite local (fonte dos dados no aparelho)
  sync/      Carga e Descarga
  features/  telas por domínio
  lib/       cliente da API e configuração
  ui/        componentes base
  mocks/     dados de demonstração
  types/     tipos espelhando os DTOs da API
```

## APK e atualizações

Geração do APK, atualização OTA (`eas update`) e aviso de versão nova: `deploy/README.md`, seção 5.
