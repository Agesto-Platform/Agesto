using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories;

namespace MicroERP.Tests.Repositories;

// PAG-01: busca e filtros das listas paginadas do web, no banco. SQLite com uma
// função translate igual à do Postgres, para exercitar o SQL de verdade.
public sealed class BuscaListagemTests
{
    [Theory]
    [InlineData("joao", new long[] { 1 })]          // sem acento acha "João"
    [InlineData("JOÃO", new long[] { 1 })]          // maiúsculas e acento no termo
    [InlineData("acacias", new long[] { 1 })]       // logradouro "R. das Acácias"
    [InlineData("fabricio", new long[] { 2 })]      // bairro
    [InlineData("uberaba", new long[] { 1, 2 })]    // cidade
    [InlineData("99990", new long[] { 1 })]         // dígitos do telefone formatado
    [InlineData("99", new long[0])]                 // menos de 3 dígitos não busca no telefone
    [InlineData("marina", new long[] { 2 })]
    public async Task Clientes_Busca_SemAcentoEmNomeEnderecoETelefone(string busca, long[] esperados)
    {
        await using var connection = AbrirSqlite(out var options);
        await SeedAsync(options);
        await using var db = new AppDbContext(options);

        var (itens, total) = await new ClienteRepository(db).GetPaginaAsync(1, 1, 50, busca, CancellationToken.None);

        Assert.Equal(esperados, itens.Select(c => c.Id).Order().ToArray());
        Assert.Equal(esperados.Length, total);
    }

    [Fact]
    public async Task Clientes_Estatisticas_ContamAtendimentosVivosEOMaisRecente()
    {
        await using var connection = AbrirSqlite(out var options);
        await SeedAsync(options);
        await using var db = new AppDbContext(options);

        var stats = await new ClienteRepository(db).GetEstatisticasAsync(1, [1, 2, 3], CancellationToken.None);

        Assert.Equal(2, stats[1].Total); // o 12 foi excluído
        Assert.Equal(new DateTime(2026, 11, 20, 9, 0, 0), stats[1].Ultimo); // agendada vale mais que o registro
        Assert.Equal(1, stats[2].Total);
        Assert.False(stats.ContainsKey(3)); // sem atendimentos
    }

    [Theory]
    [InlineData("joao", null, null, new long[] { 11, 10 })]
    [InlineData("instalacao", null, null, new long[] { 10 })]   // serviço "Instalação de AC"
    [InlineData("cabo", null, null, new long[] { 20 })]         // produto avulso
    [InlineData("filtro", null, null, new long[] { 11 })]       // produto do catálogo
    [InlineData(null, StatusAtendimento.Concluido, null, new long[] { 20, 10 })]
    [InlineData(null, null, 2L, new long[] { 20 })]
    [InlineData(null, null, null, new long[] { 11, 20, 10 })]   // ordem: agendada, senão registro, mais recente primeiro
    public async Task Atendimentos_FiltrosEOrdemDaTela(string? busca, StatusAtendimento? status, long? clienteId, long[] esperados)
    {
        await using var connection = AbrirSqlite(out var options);
        await SeedAsync(options);
        await using var db = new AppDbContext(options);

        var (itens, total) = await new AtendimentoRepository(db)
            .GetPaginaAsync(1, 1, 50, busca, status, clienteId, porRegistro: false, CancellationToken.None);

        Assert.Equal(esperados, itens.Select(a => a.Id).ToArray());
        Assert.Equal(esperados.Length, total);
        Assert.All(itens, a => Assert.NotNull(a.Cliente)); // o nome vem junto, sem lista de clientes
    }

    // Dashboard ("últimos atendimentos", ordem=registro): só a data de registro conta;
    // o 11, agendado para depois, cai para o meio.
    [Fact]
    public async Task Atendimentos_OrdemPorRegistro_MaisRecentePrimeiro()
    {
        await using var connection = AbrirSqlite(out var options);
        await SeedAsync(options);
        await using var db = new AppDbContext(options);

        var (itens, total) = await new AtendimentoRepository(db)
            .GetPaginaAsync(1, 1, 50, null, null, null, porRegistro: true, CancellationToken.None);

        Assert.Equal(new long[] { 20, 11, 10 }, itens.Select(a => a.Id).ToArray());
        Assert.Equal(3, total);
    }

    [Fact]
    public async Task Atendimentos_ContagemPorStatus_SemExcluidosNemOutraEmpresa()
    {
        await using var connection = AbrirSqlite(out var options);
        await SeedAsync(options);
        await using var db = new AppDbContext(options);

        var porStatus = await new AtendimentoRepository(db).ContarPorStatusAsync(1, CancellationToken.None);

        Assert.Equal(1, porStatus[StatusAtendimento.Pendente]);
        Assert.Equal(2, porStatus[StatusAtendimento.Concluido]);
        Assert.False(porStatus.ContainsKey(StatusAtendimento.Cancelado));
    }

    // Empresa 1: João (Acácias, Uberaba) e Marina (Fabrício, Uberaba), Renata sem nada.
    // Atendimentos: 10 João concluído (serviço), 11 João pendente agendado (filtro),
    // 12 João excluído, 20 Marina concluída (produto avulso). Empresa 2: um João também.
    private static async Task SeedAsync(DbContextOptions<AppDbContext> options)
    {
        await using var db = new AppDbContext(options);
        db.Empresas.AddRange(new Empresa { Id = 1, Nome = "Empresa" }, new Empresa { Id = 2, Nome = "Outra" });
        db.Usuarios.Add(new Usuario { Id = 5, Nome = "Dono", Email = "d@t.com", Senha = "x", EmpresaId = 1, Perfil = PerfilUsuario.Dono });
        db.Clientes.AddRange(
            new Cliente { Id = 1, Uuid = Guid.NewGuid(), Nome = "João Silva", Cpf = "1", Telefone = "(34) 99990-0000", Logradouro = "R. das Acácias", Bairro = "Centro", Cidade = "Uberaba", EmpresaId = 1 },
            new Cliente { Id = 2, Uuid = Guid.NewGuid(), Nome = "Marina Alves", Cpf = "2", Telefone = "(34) 98888-1010", Bairro = "Fabrício", Cidade = "Uberaba", EmpresaId = 1 },
            new Cliente { Id = 3, Uuid = Guid.NewGuid(), Nome = "Renata", Cpf = "3", EmpresaId = 1 },
            new Cliente { Id = 9, Uuid = Guid.NewGuid(), Nome = "João de Outra", Cpf = "9", EmpresaId = 2 });
        db.Servicos.Add(new Servico { Id = 1, Uuid = Guid.NewGuid(), Descricao = "Instalação de AC", EmpresaId = 1 });
        db.Produtos.Add(new Produto { Id = 1, Uuid = Guid.NewGuid(), Nome = "Filtro", EmpresaId = 1 });
        db.Atendimentos.AddRange(
            At(10, clienteId: 1, StatusAtendimento.Concluido, registro: new(2026, 11, 1, 9, 0, 0), agendada: null),
            At(11, clienteId: 1, StatusAtendimento.Pendente, registro: new(2026, 11, 2, 9, 0, 0), agendada: new(2026, 11, 20, 9, 0, 0)),
            At(12, clienteId: 1, StatusAtendimento.Pendente, registro: new(2026, 11, 25, 9, 0, 0), agendada: null, excluido: true),
            At(20, clienteId: 2, StatusAtendimento.Concluido, registro: new(2026, 11, 5, 9, 0, 0), agendada: null),
            At(90, clienteId: 9, StatusAtendimento.Pendente, registro: new(2026, 11, 5, 9, 0, 0), agendada: null, empresaId: 2));
        db.ItemServicos.Add(new ItemServico { Id = 1, Uuid = Guid.NewGuid(), AtendimentoId = 10, ServicoId = 1, Quantidade = 1 });
        db.ItemProdutos.AddRange(
            new ItemProduto { Id = 1, Uuid = Guid.NewGuid(), AtendimentoId = 11, ProdutoId = 1, Quantidade = 1 },
            new ItemProduto { Id = 2, Uuid = Guid.NewGuid(), AtendimentoId = 20, Descricao = "Cabo especial", Quantidade = 1 });
        await db.SaveChangesAsync();
    }

    private static Atendimento At(long id, long clienteId, StatusAtendimento status, DateTime registro, DateTime? agendada,
        bool excluido = false, long empresaId = 1) => new()
        {
            Id = id,
            Uuid = Guid.NewGuid(),
            EmpresaId = empresaId,
            UsuarioId = 5,
            ClienteId = clienteId,
            Status = status,
            DataRegistro = registro,
            DataAgendada = agendada,
            DeletedAt = excluido ? DateTime.UtcNow : null
        };

    private static SqliteConnection AbrirSqlite(out DbContextOptions<AppDbContext> options)
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();
        connection.CreateFunction("translate", (string? texto, string de, string para) => FuncoesSql.TranslateEmMemoria(texto, de, para));
        options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options;
        using var db = new AppDbContext(options);
        db.Database.EnsureCreated();
        return connection;
    }
}
