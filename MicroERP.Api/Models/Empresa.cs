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

        // Assinatura (DEC-58). PagoAte = último dia coberto pelos pagamentos; null =
        // sem cobrança (contas de teste e de antes do controle), nunca bloqueada sozinha.
        public DateOnly? PagoAte { get; set; }
        // Funcionários além do Dono: a assinatura inclui 1; os demais são licenças extras.
        public int LicencasFuncionarios { get; set; } = 1;
        // Bloqueio feito pela rotina de atraso (sai sozinho com o pagamento).
        public bool BloqueioAutomatico { get; set; }
        // PagoAte do último bloqueio automático: se a equipe desbloquear na mão, a
        // rotina só bloqueia de novo depois que o PagoAte mudar.
        public DateOnly? BloqueioAutomaticoReferencia { get; set; }

        // Navegações
        public ICollection<Usuario> Usuarios { get; set; } = new List<Usuario>();

    }
}
