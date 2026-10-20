using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MicroERP.Api.Data;
using MicroERP.Api.Models;
using MicroERP.Api.Services.Geocodificacao;

namespace MicroERP.Tests.Services;

public sealed class GeocodificacaoTests
{
    private sealed class FakeGeocodificador : IGeocodificador
    {
        public List<string> Consultas { get; } = [];
        public Func<string, Coordenadas?> Resposta { get; set; } = _ => new Coordenadas(-19.75, -47.93);
        public bool Habilitado => true;

        public Task<Coordenadas?> GeocodificarAsync(string endereco, CancellationToken cancellationToken)
        {
            Consultas.Add(endereco);
            return Task.FromResult(Resposta(endereco));
        }
    }

    [Fact]
    public async Task ProcessarLote_PreencheCoordenadasEMandaSoOEndereco()
    {
        await using var db = CreateContext();
        db.Clientes.Add(Cliente(1, rua: "Rua Artur Machado"));
        db.Clientes.Add(Cliente(2, rua: null)); // sem rua: não há o que geocodificar
        await db.SaveChangesAsync();
        var geo = new FakeGeocodificador();

        var processados = await GeocodificacaoProcessor.ProcessarLoteAsync(db, geo, 10, TimeSpan.Zero, CancellationToken.None);

        Assert.Equal(1, processados);
        Assert.Equal(["Rua Artur Machado, 100, Centro, Uberaba, 38010-020, Brasil"], geo.Consultas);
        var cliente = await db.Clientes.SingleAsync(c => c.Id == 1);
        Assert.Equal(-19.75, cliente.Latitude);
        Assert.NotNull(cliente.GeocodificadoEm);
        Assert.DoesNotContain(geo.Consultas, c => c.Contains("Maria") || c.Contains("52998224725"));
    }

    [Fact]
    public async Task ProcessarLote_EnderecoNaoEncontrado_MarcaParaNaoRepetir()
    {
        await using var db = CreateContext();
        db.Clientes.Add(Cliente(1, rua: "Rua Inexistente"));
        await db.SaveChangesAsync();
        var geo = new FakeGeocodificador { Resposta = _ => null };

        await GeocodificacaoProcessor.ProcessarLoteAsync(db, geo, 10, TimeSpan.Zero, CancellationToken.None);
        await GeocodificacaoProcessor.ProcessarLoteAsync(db, geo, 10, TimeSpan.Zero, CancellationToken.None);

        Assert.Single(geo.Consultas);
        var cliente = await db.Clientes.SingleAsync();
        Assert.Null(cliente.Latitude);
        Assert.NotNull(cliente.GeocodificadoEm);
    }

    [Fact]
    public async Task ProcessarLote_FalhaDoProvedor_DeixaPendente()
    {
        await using var db = CreateContext();
        db.Clientes.Add(Cliente(1, rua: "Rua A"));
        await db.SaveChangesAsync();
        var geo = new FakeGeocodificador { Resposta = _ => throw new HttpRequestException("429", null, HttpStatusCode.TooManyRequests) };

        await Assert.ThrowsAsync<HttpRequestException>(() =>
            GeocodificacaoProcessor.ProcessarLoteAsync(db, geo, 10, TimeSpan.Zero, CancellationToken.None));

        Assert.Null((await db.Clientes.SingleAsync()).GeocodificadoEm);
    }

    [Fact]
    public void OpenRouteService_LeLongitudeELatitudeDoGeoJson()
    {
        using var json = JsonDocument.Parse("""{"features":[{"geometry":{"type":"Point","coordinates":[-47.9319,-19.7483]}}]}""");
        Assert.Equal(new Coordenadas(-19.7483, -47.9319), OpenRouteServiceGeocodificador.LerPrimeiraCoordenada(json.RootElement));

        using var vazio = JsonDocument.Parse("""{"features":[]}""");
        Assert.Null(OpenRouteServiceGeocodificador.LerPrimeiraCoordenada(vazio.RootElement));
    }

    [Fact]
    public void OpenRouteService_SemChave_FicaDesligado()
    {
        var geo = new OpenRouteServiceGeocodificador(new HttpClient(), Options.Create(new GeocodificacaoOptions()));
        Assert.False(geo.Habilitado);
    }

    private static Cliente Cliente(long id, string? rua) => new()
    {
        Id = id, Uuid = Guid.NewGuid(), EmpresaId = 1, Nome = "Maria", Cpf = "52998224725",
        Logradouro = rua, Numero = "100", Bairro = "Centro", Cidade = "Uberaba", Cep = "38010-020",
    };

    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
}
