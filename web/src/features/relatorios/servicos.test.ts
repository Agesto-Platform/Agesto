import { describe, it, expect } from 'vitest'
import { metaServico } from './servicos'
import type { ServicoReceitaItem } from '../../types/api'

const servico = (over: Partial<ServicoReceitaItem> = {}): ServicoReceitaItem => ({
  servicoId: 1,
  descricao: 'Instalação de AC',
  tipoCobranca: 'Empreitada',
  quantidade: 18,
  receita: 6400,
  horas: 36,
  receitaPorHora: 177.78,
  margem: 4800,
  margemPorHora: 133.33,
  ...over,
})

describe('metaServico', () => {
  it('mostra a receita e a margem por hora (KAN-29)', () => {
    expect(metaServico(servico())).toMatch(/^18 atendimentos · Empreitada · R\$\s178\/h · margem R\$\s133\/h$/)
  })

  it('sem duração cadastrada, não mostra os valores por hora', () => {
    const meta = metaServico(servico({ quantidade: 1, horas: null, receitaPorHora: null, margemPorHora: null }))
    expect(meta).toBe('1 atendimento · Empreitada')
  })

  it('traduz a cobrança por hora', () => {
    expect(metaServico(servico({ tipoCobranca: 'PorHora' }))).toContain('Por hora')
  })
})
