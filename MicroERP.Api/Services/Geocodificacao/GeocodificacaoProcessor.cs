using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;

namespace MicroERP.Api.Services.Geocodificacao;

// Um lote de clientes pendentes de geocodificação. Separado do worker para testar
// sem relógio nem rede.
public static class GeocodificacaoProcessor
{
    public static async Task<int> ProcessarLoteAsync(
        AppDbContext db,
        IGeocodificador geocodificador,
        int tamanho,
        TimeSpan intervaloEntreChamadas,
        CancellationToken cancellationToken)
    {
        var pendentes = await db.Clientes
            .Where(c => c.GeocodificadoEm == null && c.DeletedAt == null && c.Logradouro != null && c.Logradouro != "")
            .OrderBy(c => c.UpdatedAt)
            .Take(tamanho)
            .ToListAsync(cancellationToken);

        var processados = 0;
        foreach (var cliente in pendentes)
        {
            var endereco = Enderecos.Completo(cliente);
            if (endereco is null) continue;

            if (processados > 0 && intervaloEntreChamadas > TimeSpan.Zero)
                await Task.Delay(intervaloEntreChamadas, cancellationToken);

            // Exceção (rede, cota) sobe sem marcar o cliente: ele é tentado de novo depois.
            var coordenadas = await geocodificador.GeocodificarAsync($"{endereco}, Brasil", cancellationToken);
            cliente.Latitude = coordenadas?.Latitude;
            cliente.Longitude = coordenadas?.Longitude;
            cliente.GeocodificadoEm = DateTime.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
            processados++;
        }

        return processados;
    }
}
