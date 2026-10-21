/**
 * Tipos espelhando os DTOs do backend (MicroERP.Api).
 * Serialização: camelCase nas chaves; enums como string (JsonStringEnumConverter).
 */

/** Envelope padrão de toda resposta da API. */
export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T | null
  errors: string[]
}

/* ---------- Auth ---------- */

export interface AuthResponse {
  token: string
  expiresAt: string // ISO
  /** Senha provisória definida pelo Dono: exige troca antes de usar o painel. */
  deveTrocarSenha?: boolean
}

export interface TrocarSenhaInput {
  senhaAtual: string
  novaSenha: string
}

/* ---------- Usuários da empresa (Dono e agentes) ---------- */

export type PerfilUsuario = 'Dono' | 'Agente'

export interface Usuario {
  id: number
  nome: string
  email: string
  perfil: PerfilUsuario
  ativo: boolean
  deveTrocarSenha: boolean
  ultimoAcessoEm: string | null
  createdAt: string
}

export interface UsuarioCreateInput {
  nome: string
  email: string
  perfil: PerfilUsuario
}

export interface UsuarioUpdateInput {
  nome: string
  perfil: PerfilUsuario
}

/** Resposta de criação e redefinição: a senha só aparece aqui, uma vez. */
export interface UsuarioSenhaProvisoria {
  usuario: Usuario
  senhaProvisoria: string
}

/* ---------- Métricas / Dashboard ---------- */

export interface MetricasRentabilidade {
  faturamento: number
  custoTotal: number
  margem: number
  margemPercentual: number
  atendimentos: number
  ticketMedio: number
}

export interface ProdutoRankingItem {
  produtoId: number
  nome: string
  quantidade: number
  receita: number
}

export interface FaturamentoPontoPeriodo {
  data: string // ISO
  valor: number
}

export interface MetricasVendas {
  receitaTotal: number
  ticketMedio: number
  totalAtendimentos: number
  topProdutos: ProdutoRankingItem[]
  receitaPorPeriodo: FaturamentoPontoPeriodo[]
}

export interface ServicoReceitaItem {
  servicoId: number
  descricao: string
  tipoCobranca: string
  quantidade: number
  receita: number
}

export interface MetricasServicos {
  receitaTotal: number
  receitaPorServico: ServicoReceitaItem[]
}

export interface ProdutoGiroItem {
  produtoId: number
  nome: string
  quantidadeEstoque: number
  unidadesVendidas: number
}

export interface ProdutoParadoItem {
  produtoId: number
  nome: string
  quantidadeEstoque: number
  ultimaVenda: string | null
}

export interface RupturaIminenteItem {
  produtoId: number
  nome: string
  quantidadeEstoque: number
  consumoDiarioMedio: number
  diasAteRuptura: number
}

export interface MetricasEstoque {
  giro: ProdutoGiroItem[]
  produtosParados: ProdutoParadoItem[]
  rupturaIminente: RupturaIminenteItem[]
}

export interface DashboardResponse {
  de: string
  ate: string
  rentabilidade: MetricasRentabilidade
  vendas: MetricasVendas
  servicos: MetricasServicos
  estoque: MetricasEstoque
}

/* ---------- Cadastros (CRUD) ---------- */

export interface Cliente {
  id: number
  uuid: string
  nome: string
  telefone: string | null
  cpf: string
  logradouro: string | null
  numero: string | null
  bairro: string | null
  cidade: string | null
  cep: string | null
  createdAt: string
  updatedAt: string
}

export interface ClienteInput {
  nome: string
  telefone?: string | null
  cpf: string
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  cep?: string | null
}

export interface Produto {
  id: number
  uuid: string
  nome: string
  preco: number
  quantidadeEstoque: number
  createdAt: string
  updatedAt: string
}

export interface ProdutoInput {
  nome: string
  preco: number
  quantidadeEstoque: number
}

export type TipoCobranca = 'PorHora' | 'Empreitada'

export interface Servico {
  id: number
  uuid: string
  descricao: string
  tipoCobranca: TipoCobranca
  valorHora: number | null
  valorEmpreitada: number | null
  /** false = criado pelo agente no app, aguardando revisão do Dono. */
  revisado: boolean
  criadoPorUsuarioId: number | null
  criadoPorNome: string | null
  createdAt: string
  updatedAt: string
}

export interface ServicoInput {
  descricao: string
  tipoCobranca: TipoCobranca
  valorHora?: number | null
  valorEmpreitada?: number | null
}

/* ---------- Orçamento ---------- */

export type StatusOrcamento = 'Rascunho' | 'Enviado' | 'Aprovado' | 'Recusado'

export interface ItemOrcamento {
  id: number
  produtoId: number | null
  servicoId: number | null
  descricao: string | null
  quantidade: number
  precoUnitario: number
  subtotal: number
  custo: number | null
}

export interface Orcamento {
  id: number
  uuid: string
  clienteId: number
  status: StatusOrcamento
  valorTotal: number
  dataRegistro: string
  atendimentoConvertidoId: number | null
  createdAt: string
  updatedAt: string
  itens: ItemOrcamento[]
}

export interface ItemOrcamentoInput {
  produtoId?: number | null
  servicoId?: number | null
  descricao?: string | null
  quantidade: number
  precoUnitario: number
  custo?: number | null
}

export interface OrcamentoInput {
  clienteId: number
  status: StatusOrcamento
  itens: ItemOrcamentoInput[]
}

/* ---------- Atendimento (para a tabela "últimos atendimentos") ---------- */

export type StatusAtendimento = 'Pendente' | 'Concluido' | 'Cancelado'

/**
 * Item enxuto para a lista de últimos atendimentos do painel.
 * NB: hoje nenhum endpoint devolve {resumo, clienteNome, margem} juntos —
 * este é o formato-alvo que o mock materializa; vira uma task de backend.
 */
export interface AtendimentoResumo {
  id: number
  resumo: string
  clienteNome: string
  valorTotal: number
  margem: number
  status: StatusAtendimento
}

/* ---------- Configuração (parametrização da empresa) ---------- */

export type TipoOperacao = 'Venda' | 'Servico' | 'Hibrido'
export type ModoAgendaAgente = 'Flexivel' | 'Fixa'

export interface Configuracao {
  id: number
  tipoOperacao: TipoOperacao
  modoAgendaAgente: ModoAgendaAgente
  controlaEstoque: boolean
  /** O agente pode cadastrar serviço novo pelo app (vai para revisão). */
  agenteCadastraServico: boolean
  empresaId: number
  createdAt: string
  updatedAt: string
}

/** Campos editáveis da configuração (patch parcial no PUT). */
export type ConfiguracaoPatch = Partial<
  Pick<Configuracao, 'tipoOperacao' | 'modoAgendaAgente' | 'controlaEstoque' | 'agenteCadastraServico'>
>

/** Material sugerido (kit) de um serviço. */
export interface ServicoSugerido {
  produtoId: number
  produtoNome: string
  quantidadePadrao: number
}

/** Item enviado no PUT do kit de um serviço. */
export interface ServicoSugeridoInput {
  produtoId: number
  quantidadePadrao: number
}

/* ---------- Atendimento (execução) ---------- */

export interface Atendimento {
  id: number
  uuid: string
  dataRegistro: string
  dataAgendada: string | null
  status: StatusAtendimento
  valorTotal: number
  custoTotal: number
  margem: number
  clienteId: number
  /** Agente responsável (quem executa). */
  usuarioId: number
  createdAt: string
  updatedAt: string
}

export interface AtendimentoInput {
  clienteId: number
  status: StatusAtendimento
  dataAgendada?: string | null
  /** Agente responsável. Ausente = o próprio Dono. */
  responsavelId?: number | null
}

export interface AtendimentoUpdate {
  status: StatusAtendimento
  dataAgendada?: string | null
  /** Ausente = mantém o responsável atual. */
  responsavelId?: number | null
}

export interface ItemProdutoResp {
  id: number
  uuid: string
  quantidade: number
  precoUnitario: number
  subtotal: number
  custo: number | null
  descricao: string | null
  atendimentoId: number
  produtoId: number | null
  createdAt: string
  updatedAt: string
}

export interface ItemProdutoInput {
  atendimentoId: number
  produtoId?: number | null
  descricao?: string | null
  precoUnitario?: number | null
  custo?: number | null
  quantidade: number
}

export interface ItemServicoResp {
  id: number
  uuid: string
  quantidade: number
  precoUnitario: number
  subtotal: number
  atendimentoId: number
  servicoId: number
  createdAt: string
  updatedAt: string
}

export interface ItemServicoInput {
  atendimentoId: number
  servicoId: number
  precoUnitario?: number | null
  quantidade: number
}

/** Item de agenda enriquecido (GET /api/atendimento/agenda). */
export interface AgendaItem {
  id: number
  uuid: string
  dataAgendada: string | null
  status: StatusAtendimento
  valorTotal: number
  usuarioId: number
  clienteId: number
  clienteNome: string
  clienteTelefone: string | null
  enderecoResumo: string | null
  /** Coordenadas do cliente para o mapa; null enquanto não geocodificado. */
  latitude?: number | null
  longitude?: number | null
  resumo: string
}
