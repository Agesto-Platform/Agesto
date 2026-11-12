import type { Orcamento } from '../../types/api'
import { itemLabel, numero } from './labels'

/**
 * PDF do orçamento para o cliente (DEC-56). Gerado no navegador, sem passar pelo
 * servidor. Leva só o que o cliente deve ver: nunca custo nem margem.
 * O jsPDF é carregado sob demanda (`carregarJsPdf`) para não pesar no painel.
 */

export interface LinhaPdf {
  descricao: string
  detalhe?: string
  quantidade: number
  precoUnitario: number
  subtotal: number
}

export interface DadosPdfOrcamento {
  empresaNome: string | null
  empresaDocumento?: string | null
  numero: string
  dataRegistro: string
  clienteNome: string
  clienteTelefone?: string | null
  linhas: LinhaPdf[]
  total: number
}

export function carregarJsPdf() {
  return import('jspdf')
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
/** Intl usa espaço não separável depois do "R$"; a fonte padrão do PDF prefere o comum. */
export const reais = (v: number) => moeda.format(v).replace(/\s/g, ' ')

const dataBr = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

/** "orcamento-0007.pdf" a partir de "#0007". */
export function nomeArquivoPdf(numero: string): string {
  return `orcamento-${numero.replace(/\D/g, '')}.pdf`
}

/** Monta o PDF (A4, retrato) e devolve o arquivo. */
export async function gerarPdfOrcamento(d: DadosPdfOrcamento): Promise<Blob> {
  const { jsPDF } = await carregarJsPdf()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const L = 18
  const R = 192
  const fimDaPagina = 275
  let y = 22

  // Cabeçalho: empresa à esquerda, número e data à direita.
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(20)
  doc.text(d.empresaNome?.trim() || 'Orçamento', L, y)
  doc.setFontSize(12)
  doc.text(`Orçamento ${d.numero}`, R, y, { align: 'right' })
  y += 6
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(100)
  if (d.empresaDocumento) doc.text(d.empresaDocumento, L, y)
  doc.text(`Emitido em ${dataBr(d.dataRegistro)}`, R, y, { align: 'right' })
  y += 5
  doc.setDrawColor(210).setLineWidth(0.3).line(L, y, R, y)
  y += 9

  // Cliente.
  doc.setFontSize(9).setTextColor(110).text('CLIENTE', L, y)
  y += 5
  doc.setFont('helvetica', 'bold').setFontSize(11.5).setTextColor(20).text(d.clienteNome, L, y)
  if (d.clienteTelefone) {
    doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(100).text(d.clienteTelefone, R, y, { align: 'right' })
  }
  y += 10

  // Tabela de itens.
  const cQtd = 128
  const cPreco = 160
  const larguraItem = cQtd - L - 14
  const cabecalho = () => {
    doc.setFillColor(242, 243, 245).rect(L, y - 5, R - L, 8, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(80)
    doc.text('Item', L + 2, y)
    doc.text('Qtd.', cQtd, y, { align: 'right' })
    doc.text('Preço un.', cPreco, y, { align: 'right' })
    doc.text('Subtotal', R - 2, y, { align: 'right' })
    y += 8
  }
  cabecalho()

  for (const l of d.linhas) {
    const linhasTexto: string[] = doc.setFont('helvetica', 'bold').setFontSize(10).splitTextToSize(l.descricao, larguraItem)
    const altura = linhasTexto.length * 4.6 + (l.detalhe ? 4.4 : 0) + 3
    if (y + altura > fimDaPagina) {
      doc.addPage()
      y = 22
      cabecalho()
    }
    doc.setTextColor(25).text(linhasTexto, L + 2, y)
    doc.setFont('helvetica', 'normal').setFontSize(10)
    doc.text(l.quantidade.toLocaleString('pt-BR'), cQtd, y, { align: 'right' })
    doc.text(reais(l.precoUnitario), cPreco, y, { align: 'right' })
    doc.setFont('helvetica', 'bold').text(reais(l.subtotal), R - 2, y, { align: 'right' })
    let yDetalhe = y + linhasTexto.length * 4.6
    if (l.detalhe) {
      doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(120).text(l.detalhe, L + 2, yDetalhe - 0.6)
      yDetalhe += 4.4
    }
    y = yDetalhe + 3
    doc.setDrawColor(230).setLineWidth(0.2).line(L, y - 4, R, y - 4)
  }

  // Total.
  if (y + 14 > fimDaPagina) {
    doc.addPage()
    y = 22
  }
  y += 4
  doc.setFont('helvetica', 'bold').setFontSize(12.5).setTextColor(20)
  doc.text('Total', cPreco, y, { align: 'right' })
  doc.text(reais(d.total), R - 2, y, { align: 'right' })

  // Rodapé em todas as páginas.
  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(150)
    doc.text('Orçamento gerado pelo Agesto.', L, 288)
    if (paginas > 1) doc.text(`Página ${p} de ${paginas}`, R, 288, { align: 'right' })
  }

  return doc.output('blob')
}

const COBRANCA: Record<string, string> = { PorHora: 'Por hora', Empreitada: 'Empreitada' }

/** Dados do PDF a partir do orçamento da tela (sem custo nem margem). */
export function dadosDoPdf(
  o: Orcamento,
  clienteNome: string,
  empresa: { nome?: string | null; documento?: string | null } | null | undefined,
): DadosPdfOrcamento {
  return {
    empresaNome: empresa?.nome ?? null,
    empresaDocumento: empresa?.documento ?? null,
    numero: numero(o.id),
    dataRegistro: o.dataRegistro,
    clienteNome,
    clienteTelefone: o.clienteTelefone,
    linhas: o.itens.map((it) => {
      const tipo = it.servicoId != null ? 'Serviço' : it.produtoId != null ? 'Material' : undefined
      const cobranca = it.servicoId != null && it.tipoCobranca ? COBRANCA[it.tipoCobranca] ?? it.tipoCobranca : undefined
      return {
        descricao: itemLabel(it),
        detalhe: [tipo, cobranca].filter(Boolean).join(' · ') || undefined,
        quantidade: it.quantidade,
        precoUnitario: it.precoUnitario,
        subtotal: it.subtotal,
      }
    }),
    total: o.valorTotal,
  }
}
