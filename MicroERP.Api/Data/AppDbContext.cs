using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Models;

namespace MicroERP.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Empresa> Empresas => Set<Empresa>();
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Configuracao> Configuracoes => Set<Configuracao>();
    public DbSet<Cliente> Clientes => Set<Cliente>();
    public DbSet<Servico> Servicos => Set<Servico>();
    public DbSet<Produto> Produtos => Set<Produto>();
    public DbSet<Atendimento> Atendimentos => Set<Atendimento>();
    public DbSet<ItemProduto> ItemProdutos => Set<ItemProduto>();
    public DbSet<ItemServico> ItemServicos => Set<ItemServico>();
    public DbSet<Orcamento> Orcamentos => Set<Orcamento>();
    public DbSet<ItemOrcamento> ItemOrcamentos => Set<ItemOrcamento>();
    public DbSet<ServicoItemSugerido> ServicoItemSugeridos => Set<ServicoItemSugerido>();

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries()
            .Where(e => e.State is EntityState.Modified))
        {
            if (entry.Properties.Any(p => p.Metadata.Name == "UpdatedAt"))
                entry.Property("UpdatedAt").CurrentValue = now;
        }
        return base.SaveChangesAsync(cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Empresa>(entity =>
        {
            entity.Property(e => e.Nome).HasMaxLength(150).IsRequired();
            entity.Property(e => e.Documento).HasMaxLength(18).IsRequired().IsRequired(false);
        });

        modelBuilder.Entity<Usuario>(entity =>
        {
            entity.Property(e => e.Nome).HasMaxLength(120).IsRequired();
            entity.Property(e => e.Email).HasMaxLength(150).IsRequired();
            entity.Property(e => e.Senha).HasMaxLength(255).IsRequired();
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.Perfil)
               .HasConversion<string>()
               .HasMaxLength(10)
               .IsRequired();
            entity.HasOne(e => e.Empresa)
                .WithMany(emp => emp.Usuarios)
                .HasForeignKey(e => e.EmpresaId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Configuracao>(entity =>
        {
            entity.Property(e => e.TipoOperacao)
                .HasConversion<string>()
                .HasMaxLength(10)
                .IsRequired();
            entity.Property(e => e.ModoAgendaAgente)
                .HasConversion<string>()
                .HasMaxLength(10)
                .IsRequired();
            entity.HasIndex(e => e.EmpresaId).IsUnique();
            entity.HasOne(e => e.Empresa)
                .WithMany()
                .HasForeignKey(e => e.EmpresaId)
                .OnDelete(DeleteBehavior.Cascade);

        });

        modelBuilder.Entity<Cliente>(entity =>
        {
            entity.Property(e => e.Uuid).IsRequired();
            entity.Property(e => e.Nome).HasMaxLength(120).IsRequired();
            entity.Property(e => e.Telefone).HasMaxLength(20);
            entity.Property(e => e.Cpf).HasMaxLength(14).IsRequired();
            entity.Property(e => e.Logradouro).HasMaxLength(150);
            entity.Property(e => e.Numero).HasMaxLength(20);
            entity.Property(e => e.Bairro).HasMaxLength(100);
            entity.Property(e => e.Cidade).HasMaxLength(100);
            entity.Property(e => e.Cep).HasMaxLength(9);
            entity.HasIndex(e => new { e.EmpresaId, e.Cpf }).IsUnique();
            entity.HasIndex(e => e.Uuid).IsUnique();
            entity.HasIndex(e => e.EmpresaId);
        });

        modelBuilder.Entity<Servico>(entity =>
        {
            entity.Property(e => e.Uuid).IsRequired();
            entity.Property(e => e.Descricao).HasMaxLength(200).IsRequired();
            entity.Property(e => e.ValorHora).HasColumnType("decimal(12,2)").IsRequired(false);
            entity.HasIndex(e => e.Uuid).IsUnique();
            entity.HasIndex(e => e.EmpresaId);
            entity.Property(e => e.TipoCobranca)
                .HasConversion<string>()
                .HasMaxLength(10)
                .IsRequired();
            entity.Property(e => e.ValorEmpreitada)
            .HasColumnType("decimal(12,2)")
            .IsRequired(false);
        });

        modelBuilder.Entity<Produto>(entity =>
        {
            entity.Property(e => e.Uuid).IsRequired();
            entity.Property(e => e.Nome).HasMaxLength(120).IsRequired();
            entity.Property(e => e.Preco).HasColumnType("decimal(12,2)").IsRequired();
            entity.Property(e => e.QuantidadeEstoque).IsRequired();
            entity.HasIndex(e => e.Uuid).IsUnique();
            entity.HasIndex(e => e.EmpresaId);
        });

        modelBuilder.Entity<Atendimento>(entity =>
        {
            entity.Property(e => e.Uuid).IsRequired();
            entity.Property(e => e.Status)
                .HasConversion<string>()
                .HasMaxLength(30)
                .IsRequired();
            entity.Property(e => e.ValorTotal).HasColumnType("decimal(12,2)").IsRequired();
            entity.Property(e => e.CustoTotal).HasColumnType("decimal(12,2)").IsRequired();
            entity.Property(e => e.DataRegistro).IsRequired();
            entity.HasIndex(e => e.Uuid).IsUnique();
            entity.HasIndex(e => e.EmpresaId);
            entity.HasIndex(e => e.UsuarioId);
            entity.HasOne(e => e.Cliente)
                .WithMany()
                .HasForeignKey(e => e.ClienteId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ItemProduto>(entity =>
        {
            entity.Property(e => e.Uuid).IsRequired();
            entity.Property(e => e.PrecoUnitario).HasColumnType("decimal(12,2)").IsRequired();
            entity.Property(e => e.Subtotal).HasColumnType("decimal(12,2)").IsRequired();
            entity.Property(e => e.Custo).HasColumnType("decimal(12,2)").IsRequired(false);
            entity.Property(e => e.Descricao).HasMaxLength(200);
            entity.HasIndex(e => e.Uuid).IsUnique();
            entity.HasIndex(e => e.AtendimentoId);
            entity.HasIndex(e => e.ProdutoId);
            entity.HasOne(e => e.Atendimento)
                .WithMany(a => a.ItensProduto)
                .HasForeignKey(e => e.AtendimentoId)
                .OnDelete(DeleteBehavior.Restrict);
            // Produto opcional: item avulso (DEC-18) nao referencia catalogo.
            entity.HasOne(e => e.Produto)
                .WithMany()
                .HasForeignKey(e => e.ProdutoId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ItemServico>(entity =>
        {
            entity.Property(e => e.Uuid).IsRequired();
            entity.Property(e => e.PrecoUnitario).HasColumnType("decimal(12,2)").IsRequired();
            entity.Property(e => e.Subtotal).HasColumnType("decimal(12,2)").IsRequired();
            entity.HasIndex(e => e.Uuid).IsUnique();
            entity.HasIndex(e => e.AtendimentoId);
            entity.HasIndex(e => e.ServicoId);
            entity.HasOne(e => e.Atendimento)
                .WithMany(a => a.ItensServico)
                .HasForeignKey(e => e.AtendimentoId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.Servico)
                .WithMany()
                .HasForeignKey(e => e.ServicoId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Orcamento>(entity =>
        {
            entity.Property(e => e.Uuid).IsRequired();
            entity.Property(e => e.Status)
                .HasConversion<string>()
                .HasMaxLength(20)
                .IsRequired();
            entity.Property(e => e.ValorTotal).HasColumnType("decimal(12,2)").IsRequired();
            entity.Property(e => e.DataRegistro).IsRequired();
            entity.HasIndex(e => e.Uuid).IsUnique();
            entity.HasIndex(e => e.EmpresaId);
            entity.HasIndex(e => e.UsuarioId);
            entity.HasOne(e => e.Cliente)
                .WithMany()
                .HasForeignKey(e => e.ClienteId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ItemOrcamento>(entity =>
        {
            entity.Property(e => e.Uuid).IsRequired();
            entity.Property(e => e.PrecoUnitario).HasColumnType("decimal(12,2)").IsRequired();
            entity.Property(e => e.Subtotal).HasColumnType("decimal(12,2)").IsRequired();
            entity.Property(e => e.Custo).HasColumnType("decimal(12,2)").IsRequired(false);
            entity.Property(e => e.Descricao).HasMaxLength(200);
            entity.HasIndex(e => e.Uuid).IsUnique();
            entity.HasIndex(e => e.OrcamentoId);
            // ProdutoId/ServicoId sao referencias soltas (sem navegacao/FK): orcamento e
            // uma estimativa, nao exige integridade referencial nem baixa estoque.
            entity.HasOne(e => e.Orcamento)
                .WithMany(o => o.Itens)
                .HasForeignKey(e => e.OrcamentoId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ServicoItemSugerido>(entity =>
        {
            entity.HasIndex(e => e.EmpresaId);
            // Um produto sugerido no maximo uma vez por servico.
            entity.HasIndex(e => new { e.ServicoId, e.ProdutoId }).IsUnique();
            entity.HasOne(e => e.Servico)
                .WithMany()
                .HasForeignKey(e => e.ServicoId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.Produto)
                .WithMany()
                .HasForeignKey(e => e.ProdutoId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
