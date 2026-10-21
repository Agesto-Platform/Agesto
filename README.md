# Agesto

**ERP para prestadores de serviço autônomos** — orçamento, agenda, execução e cobrança em um fluxo só, feito para uso em campo.

> Nome de *agere* (agir/operar) + *gestio* (gestão). Antes chamado "Micro-ERP Auto".

![.NET](https://img.shields.io/badge/.NET-8.0-512BD4)
![EF Core](https://img.shields.io/badge/EF%20Core-8.0-512BD4)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Npgsql-336791)
![Backend tests](https://img.shields.io/badge/backend%20tests-90%20passing-2EA043)
![Web tests](https://img.shields.io/badge/web%20tests-21%20passing-2EA043)
![Mobile tests](https://img.shields.io/badge/mobile%20tests-29%20passing-2EA043)
![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial-orange)

---

## O problema

A maioria dos ERPs é feita para média/grande empresa — cara e complexa. O prestador de serviço autônomo (técnico de ar-condicionado, instalador, eletricista) acaba gerindo o negócio no papel ou em planilhas. O Agesto entrega o essencial, pensado para quem trabalha **em campo, muitas vezes sem internet**.

## Foco do produto

A espinha é o ciclo de vida do serviço:

```
Orçamento  →  Agendamento  →  Atendimento (execução)  →  Cobrança
```

Venda de produtos existe como recurso secundário ("plus"), habilitado conforme o modo de operação da empresa (Serviço, Venda ou Híbrido).

## Destaques técnicos

- **Multi-tenant** — isolamento por `EmpresaId` derivado do JWT (nunca do body); toda query filtra por empresa.
- **Offline-first** — o app de campo opera sem rede; sincronização por *Carga/Descarga* com resolução last-write-wins.
- **Camada de métricas determinística** — números (receita, margem, estoque) são agregados no banco; a **IA nativa** apenas interpreta esses números, nunca os calcula.
- **Margem por atendimento** — custo preenchível pelo prestador; `Margem = ValorTotal − CustoTotal`.
- **Conversão transacional** de orçamento em atendimento (baixa de estoque só na conversão).
- **Soft delete** em todo o domínio (`DeletedAt`), nunca DELETE físico.

## Arquitetura

```
Controller  →  Service (interface)  →  Repository (interface)  →  AppDbContext (EF Core)
```

- Camadas `sealed`, injeção por interface (`AddScoped`).
- Envelope de resposta padronizado `ApiResponse { Success, Message, Data, Errors }`.
- Enums persistidos como string (`HasConversion<string>()`).

| Camada | Tecnologia |
|--------|-----------|
| Backend | C# ASP.NET Core .NET 10 + Entity Framework Core 10 |
| Banco | PostgreSQL (Npgsql) |
| IA | Integração nativa planejada no backend C#; ainda não implementada |
| Web (dono) | React 19 + TypeScript + Vite + Tailwind + TanStack Query |
| Mobile (agente de campo) | React Native + Expo + SQLite, offline-first |
| Auth | JWT multi-tenant (claims `empresaId`, `sub`, `perfil`) |
| Testes | xUnit + Moq + EF Core InMemory/Sqlite |

## Status

| Área | Estado |
|------|--------|
| Backend (domínio do prestador) | 🟡 MVP avançado — **90 testes passando**; migrations aguardam banco novo |
| Camada de métricas + rentabilidade | 🟢 Implementada |
| Orçamento / Agendamento / Margem | 🟢 Implementados |
| IA nativa (insights) | ⚪ Planejada |
| Frontend Web | 🟡 MVP funcional com mocks — **21 testes** |
| Mobile | 🟡 MVP offline-first funcional — **29 testes** |

## Documentação e contribuição

- [Visão e documentação de produto](docs/project/README.md)
- [Como contribuir](CONTRIBUTING.md)
- [Regras para agentes e automações](AGENTS.md)

O fluxo da equipe é `feature/* → develop → main`. Alterações entram por pull request e `main` recebe apenas marcos revisados com as verificações relevantes verdes.

## Rodando o backend

> Pré-requisitos: .NET 10 SDK e um PostgreSQL acessível.

```bash
git clone https://github.com/Agesto-Platform/Agesto.git
cd Agesto/MicroERP.Api

# configurar segredos locais (NÃO versionados)
cp appsettings.Development.json.example appsettings.Development.json
# editar: connection string do Postgres + uma chave JWT (mín. 32 bytes)

dotnet ef database update   # cria o schema
dotnet run                  # Swagger em http://localhost:5xxx/swagger
```

Rodar os testes:

```bash
dotnet test MicroERP.sln
```

## Licença

**PolyForm Noncommercial 1.0.0** — o código pode ser lido, estudado e usado para fins **não comerciais** (estudo, pesquisa, avaliação). O uso comercial é reservado ao autor. Veja [`LICENSE`](LICENSE).

> Os identificadores internos ainda usam o namespace `MicroERP.*` (nome anterior do projeto); a renomeação para `Agesto.*` é um refactor mecânico adiado de propósito.

## Origem

O projeto começou como um trabalho acadêmico e evoluiu para um produto em desenvolvimento pela equipe fundadora: **Davi Gomes Rocha** (Founder e Product Owner), **Depowo** (Cofounder, foco inicial em infraestrutura) e **ghzpro034** (Cofounder, atuação generalista). A governança técnica usa a organização [`Agesto-Platform`](https://github.com/Agesto-Platform) e o time `Core`.
