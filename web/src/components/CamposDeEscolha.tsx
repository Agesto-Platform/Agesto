import { BuscaField, brl } from './ui'
import type { Cliente, Produto, Servico } from '../types/api'

/**
 * Campos de escolha de cliente, produto e serviço com busca no servidor
 * (PAG-01 fase 2). As chaves ficam sob as das listas: criar ou editar um
 * cadastro atualiza as opções.
 */
type Props<T> = {
  label?: string
  value: T | null
  onChange: (item: T | null) => void
  error?: string
  hint?: string
  required?: boolean
}

export function ClienteField({ label = 'Cliente', ...p }: Props<Cliente>) {
  return (
    <BuscaField<Cliente>
      {...p}
      label={label}
      queryKey={['cliente', 'list']}
      path="/api/cliente"
      rotulo={(c) => c.nome}
      detalhe={(c) => c.cidade ?? c.telefone ?? undefined}
      placeholder="Digite o nome, telefone ou cidade…"
      semResultado="Nenhum cliente encontrado."
    />
  )
}

export function ProdutoField({
  label = 'Produto',
  mostrarEstoque = false,
  ...p
}: Props<Produto> & { mostrarEstoque?: boolean }) {
  return (
    <BuscaField<Produto>
      {...p}
      label={label}
      queryKey={['produto', 'list']}
      path="/api/produto"
      rotulo={(x) => x.nome}
      detalhe={(x) => (mostrarEstoque ? `${brl(x.preco)} · ${x.quantidadeEstoque} em estoque` : brl(x.preco))}
      placeholder="Digite o nome do produto…"
      semResultado="Nenhum produto encontrado."
    />
  )
}

export function ServicoField({ label = 'Serviço', ...p }: Props<Servico>) {
  return (
    <BuscaField<Servico>
      {...p}
      label={label}
      queryKey={['servico', 'list']}
      path="/api/servico"
      rotulo={(s) => s.descricao}
      detalhe={(s) => (s.tipoCobranca === 'Empreitada' ? 'Empreitada' : 'Por hora')}
      placeholder="Digite o nome do serviço…"
      semResultado="Nenhum serviço encontrado."
    />
  )
}
