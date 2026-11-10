namespace MicroERP.Api.Models
{
    public class Empresa
    {
        public long Id { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string? Documento { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Suspensa pela equipe do Agesto (área de superadmin): ninguém da empresa
        // faz login e os tokens já emitidos param de valer (TokenRevalidator).
        public bool Ativa { get; set; } = true;
        public DateTime? BloqueadaEm { get; set; }
        public string? MotivoBloqueio { get; set; }

        // Navegações
        public ICollection<Usuario> Usuarios { get; set; } = new List<Usuario>();

    }
}
