import { useState, type FC } from 'react'
import { useConfiguracao, useUpdateConfiguracao } from './queries'
import { Card, Button, useToast } from '../../components/ui'
import { IconWrench, IconBox, IconGrid, type IconProps } from '../../components/icons'
import { ApiError } from '../../lib/api'
import type { ConfiguracaoPatch, ModoAgendaAgente, TipoOperacao } from '../../types/api'

const OPCOES: { value: TipoOperacao; titulo: string; desc: string; icon: FC<IconProps> }[] = [
  {
    value: 'Servico',
    titulo: 'Serviço',
    desc: 'Prestação de serviços — o foco do produto. Orçamento, agenda e atendimentos.',
    icon: IconWrench,
  },
  {
    value: 'Venda',
    titulo: 'Venda',
    desc: 'Venda de produtos com controle de estoque.',
    icon: IconBox,
  },
  {
    value: 'Hibrido',
    titulo: 'Híbrido',
    desc: 'Serviços e vendas juntos, no mesmo negócio.',
    icon: IconGrid,
  },
]

const MODOS_AGENDA: { value: ModoAgendaAgente; titulo: string; desc: string }[] = [
  {
    value: 'Flexivel',
    titulo: 'Flexível (solo)',
    desc: 'O agente registra e agenda atendimentos em campo, na hora.',
  },
  {
    value: 'Fixa',
    titulo: 'Fixa (equipe)',
    desc: 'O agente segue a agenda montada por você. Ainda pode registrar avulsos.',
  },
]

const ESTOQUE: { value: boolean; titulo: string; desc: string }[] = [
  {
    value: true,
    titulo: 'Controla estoque',
    desc: 'Produtos baixam estoque e validam saldo. Para quem mantém inventário.',
  },
  {
    value: false,
    titulo: 'Sem controle',
    desc: 'Produtos viram lista de materiais com preço/custo, sem baixa. Para quem compra por serviço.',
  },
]

const CADASTRO_SERVICO: { value: boolean; titulo: string; desc: string }[] = [
  {
    value: true,
    titulo: 'Agente cadastra serviço',
    desc: 'Serviço fora do catálogo pode ser criado no app. Ele aparece em Serviços como "a revisar".',
  },
  {
    value: false,
    titulo: 'Só o catálogo',
    desc: 'O agente usa apenas os serviços cadastrados por você.',
  },
]

/** Cartão de opção genérico (uma escolha dentro de um grupo). */
function OpcaoCard({
  on,
  titulo,
  desc,
  onClick,
  icon: Icon,
}: {
  on: boolean
  titulo: string
  desc: string
  onClick: () => void
  icon?: FC<IconProps>
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-2 rounded-card border p-4 text-left transition ${
        on ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-ink-4'
      }`}
    >
      {Icon && (
        <span
          className={`grid h-9 w-9 place-items-center rounded-[10px] ${
            on ? 'bg-brand text-white' : 'bg-surface-2 text-ink-3'
          }`}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
      )}
      <span className={`text-[14px] font-semibold ${on ? 'text-brand-ink' : 'text-ink'}`}>{titulo}</span>
      <span className="text-[12px] text-ink-3">{desc}</span>
    </button>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-4">
      {children}
    </div>
  )
}

export function ParametrizacaoPage() {
  const config = useConfiguracao()
  const update = useUpdateConfiguracao()
  const toast = useToast()
  const [draft, setDraft] = useState<ConfiguracaoPatch>({})

  const atual = config.data
  const tipoOperacao = draft.tipoOperacao ?? atual?.tipoOperacao
  const modoAgenda = draft.modoAgendaAgente ?? atual?.modoAgendaAgente
  const controlaEstoque = draft.controlaEstoque ?? atual?.controlaEstoque
  const agenteCadastraServico = draft.agenteCadastraServico ?? atual?.agenteCadastraServico

  const dirty =
    atual != null &&
    (tipoOperacao !== atual.tipoOperacao ||
      modoAgenda !== atual.modoAgendaAgente ||
      controlaEstoque !== atual.controlaEstoque ||
      agenteCadastraServico !== atual.agenteCadastraServico)
  const podeSalvar = dirty && !update.isPending

  function salvar() {
    if (tipoOperacao == null || modoAgenda == null || controlaEstoque == null) return
    update.mutate(
      { tipoOperacao, modoAgendaAgente: modoAgenda, controlaEstoque, agenteCadastraServico },
      {
        onSuccess: () => {
          setDraft({})
          toast.success('Parametrização atualizada.')
        },
        onError: (e) =>
          toast.error(e instanceof ApiError ? e.message : 'Não foi possível salvar.'),
      },
    )
  }

  return (
    <Card className="shadow-card">
      <div className="mb-1 text-[15px] font-semibold text-ink">Parametrização</div>
      <p className="mb-2 text-[12.5px] text-ink-3">
        Configure como o seu negócio opera. Isso define quais recursos ficam ativos.
      </p>

      {config.isLoading && (
        <p className="py-6 text-center text-[13px] text-ink-3">Carregando…</p>
      )}
      {config.isError && (
        <p className="py-6 text-center text-[13px] text-bad">
          Não foi possível carregar a configuração.
        </p>
      )}

      {atual && (
        <>
          <SectionLabel>Modo de operação</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {OPCOES.map((o) => (
              <OpcaoCard
                key={o.value}
                on={tipoOperacao === o.value}
                titulo={o.titulo}
                desc={o.desc}
                icon={o.icon}
                onClick={() => setDraft((d) => ({ ...d, tipoOperacao: o.value }))}
              />
            ))}
          </div>

          <SectionLabel>Agenda do agente (app mobile)</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {MODOS_AGENDA.map((m) => (
              <OpcaoCard
                key={m.value}
                on={modoAgenda === m.value}
                titulo={m.titulo}
                desc={m.desc}
                onClick={() => setDraft((d) => ({ ...d, modoAgendaAgente: m.value }))}
              />
            ))}
          </div>

          <SectionLabel>Controle de estoque</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ESTOQUE.map((e) => (
              <OpcaoCard
                key={String(e.value)}
                on={controlaEstoque === e.value}
                titulo={e.titulo}
                desc={e.desc}
                onClick={() => setDraft((d) => ({ ...d, controlaEstoque: e.value }))}
              />
            ))}
          </div>

          <SectionLabel>Cadastro de serviço pelo agente (app mobile)</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CADASTRO_SERVICO.map((c) => (
              <OpcaoCard
                key={String(c.value)}
                on={agenteCadastraServico === c.value}
                titulo={c.titulo}
                desc={c.desc}
                onClick={() => setDraft((d) => ({ ...d, agenteCadastraServico: c.value }))}
              />
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3 border-t border-line pt-4">
            <Button onClick={salvar} disabled={!podeSalvar}>
              {update.isPending ? 'Salvando…' : 'Salvar alterações'}
            </Button>
            {!dirty && <span className="text-[12px] text-ink-4">Nenhuma alteração pendente.</span>}
          </div>
        </>
      )}
    </Card>
  )
}
