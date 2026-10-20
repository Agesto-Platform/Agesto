import { describe, it, expect } from 'vitest'
import { navVisivel } from './nav'

const rotas = (tipo: Parameters<typeof navVisivel>[0]) =>
  navVisivel(tipo).flatMap((g) => g.items.map((i) => i.to))

describe('navVisivel', () => {
  it('Hibrido mostra tudo', () => {
    const r = rotas('Hibrido')
    expect(r).toContain('/servicos')
    expect(r).toContain('/agenda')
    expect(r).toContain('/produtos')
  })

  it('Servico mantém Produtos (materiais) e Serviços', () => {
    const r = rotas('Servico')
    expect(r).toContain('/produtos')
    expect(r).toContain('/servicos')
    expect(r).toContain('/agenda')
  })

  it('Venda esconde Serviços e Agenda, mas mantém Produtos', () => {
    const r = rotas('Venda')
    expect(r).not.toContain('/servicos')
    expect(r).not.toContain('/agenda')
    expect(r).toContain('/produtos')
    expect(r).toContain('/atendimentos')
    expect(r).toContain('/parametrizacao')
  })

  it('Usuários aparece em todos os modos', () => {
    for (const tipo of ['Hibrido', 'Servico', 'Venda'] as const) {
      expect(rotas(tipo)).toContain('/usuarios')
    }
  })

  it('sem config (undefined) mostra tudo', () => {
    expect(rotas(undefined)).toContain('/servicos')
  })
})
