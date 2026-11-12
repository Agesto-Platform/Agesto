import { describe, it, expect } from 'vitest'
import { dadosDoPdf, gerarPdfOrcamento, nomeArquivoPdf } from './pdf'
import type { Orcamento } from '../../types/api'

const orcamento: Orcamento = {
  id: 7,
  uuid: 'u',
  clienteId: 1,
  clienteTelefone: '(34) 99999-0000',
  status: 'Enviado',
  valorTotal: 490,
  dataRegistro: '2026-11-12T12:00:00.000Z',
  atendimentoConvertidoId: null,
  createdAt: '',
  updatedAt: '',
  itens: [
    { id: 1, produtoId: null, servicoId: 3, servicoDescricao: 'Instalação de AC', descricao: null, tipoCobranca: 'Empreitada', quantidade: 1, precoUnitario: 350, subtotal: 350, custo: 200 },
    { id: 2, produtoId: 4, servicoId: null, produtoNome: 'Suporte universal', descricao: null, quantidade: 2, precoUnitario: 70, subtotal: 140, custo: 80 },
  ],
} as Orcamento

describe('dadosDoPdf', () => {
  it('leva empresa, cliente, itens e total, sem custo', () => {
    const d = dadosDoPdf(orcamento, 'Vó Joana', { nome: 'Clima Bom', documento: '12.345.678/0001-90' })
    expect(d).toMatchObject({
      empresaNome: 'Clima Bom',
      empresaDocumento: '12.345.678/0001-90',
      numero: '#0007',
      clienteNome: 'Vó Joana',
      clienteTelefone: '(34) 99999-0000',
      total: 490,
    })
    expect(d.linhas).toEqual([
      { descricao: 'Instalação de AC', detalhe: 'Serviço · Empreitada', quantidade: 1, precoUnitario: 350, subtotal: 350 },
      { descricao: 'Suporte universal', detalhe: 'Material', quantidade: 2, precoUnitario: 70, subtotal: 140 },
    ])
    expect(JSON.stringify(d)).not.toMatch(/custo/i)
  })

  it('sem a configuração carregada, o PDF sai sem o nome da empresa', () => {
    expect(dadosDoPdf(orcamento, 'Vó Joana', undefined).empresaNome).toBeNull()
  })
})

describe('gerarPdfOrcamento', () => {
  it('gera um PDF', async () => {
    const pdf = await gerarPdfOrcamento(dadosDoPdf(orcamento, 'Vó Joana', { nome: 'Clima Bom' }))
    expect(pdf.type).toBe('application/pdf')
    const inicio = new TextDecoder().decode(await pdf.slice(0, 5).arrayBuffer())
    expect(inicio).toBe('%PDF-')
  })
})

describe('nomeArquivoPdf', () => {
  it('usa o número do orçamento', () => {
    expect(nomeArquivoPdf('#0007')).toBe('orcamento-0007.pdf')
  })
})
