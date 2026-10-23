import { useState, type FormEvent } from 'react'
import { useConfiguracao, useUpdateConfiguracao } from './queries'
import { Badge, Button, Card, CardBody, PageHead, Switch, useToast } from '../../components/ui'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../lib/api'
import type { ConfiguracaoPatch, ModoAgendaAgente, TipoOperacao } from '../../types/api'
import './parametrizacao.css'

const OPERACOES: { value: TipoOperacao; titulo: string; desc: string }[] = [
  { value: 'Servico', titulo: 'Serviço', desc: 'Orçamento, agenda e atendimento' },
  { value: 'Venda', titulo: 'Venda', desc: 'Só produtos e vendas' },
  { value: 'Hibrido', titulo: 'Híbrido', desc: 'Serviço e venda juntos' },
]

const AGENDAS: { value: ModoAgendaAgente; titulo: string; desc: string }[] = [
  { value: 'Flexivel', titulo: 'Flexível', desc: 'Você trabalha sozinho ou com 1-2 ajudantes e agenda em campo.' },
  { value: 'Fixa', titulo: 'Fixa', desc: 'Você monta a agenda e a equipe segue pelo app.' },
]

export function ParametrizacaoPage() {
  const config = useConfiguracao()
  const update = useUpdateConfiguracao()
  const toast = useToast()
  const { user } = useAuth()
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

  function salvar(e: FormEvent) {
    e.preventDefault()
    if (!podeSalvar || tipoOperacao == null || modoAgenda == null || controlaEstoque == null) return
    update.mutate(
      { tipoOperacao, modoAgendaAgente: modoAgenda, controlaEstoque, agenteCadastraServico },
      {
        onSuccess: () => {
          setDraft({})
          toast.success('Parametrização atualizada.')
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar.'),
      },
    )
  }

  function descartar(e: FormEvent) {
    e.preventDefault()
    setDraft({})
  }

  const head = (
    <PageHead
      title="Parametrização"
      sub="Como a sua empresa trabalha. Muda o que aparece no painel e no app do técnico."
    />
  )

  if (!atual) {
    return (
      <>
        {head}
        <Card>
          <CardBody>
            <p className="hint" style={{ margin: 0, padding: '24px 0', textAlign: 'center' }}>
              {config.isError ? 'Não foi possível carregar a configuração.' : 'Carregando…'}
            </p>
          </CardBody>
        </Card>
      </>
    )
  }

  return (
    <>
      {head}

      <form className="settings" onSubmit={salvar} onReset={descartar}>
        <section className="card set">
          <div>
            <h2>Tipo de operação</h2>
            <p className="desc">No modo Venda, Serviços e Agenda saem do menu.</p>
          </div>
          <div className="opts row" role="radiogroup" aria-label="Tipo de operação">
            {OPERACOES.map((o) => (
              <label className="opt" key={o.value}>
                <input
                  type="radio"
                  name="op"
                  checked={tipoOperacao === o.value}
                  onChange={() => setDraft((d) => ({ ...d, tipoOperacao: o.value }))}
                />
                <b>{o.titulo}</b>
                <span>{o.desc}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="card set">
          <div>
            <h2>Agenda dos técnicos</h2>
            <p className="desc">Vale para o app do técnico em campo.</p>
          </div>
          <div className="opts row2" role="radiogroup" aria-label="Modo da agenda">
            {AGENDAS.map((a) => (
              <label className="opt" key={a.value}>
                <input
                  type="radio"
                  name="ag"
                  checked={modoAgenda === a.value}
                  onChange={() => setDraft((d) => ({ ...d, modoAgendaAgente: a.value }))}
                />
                <b>{a.titulo}</b>
                <span>{a.desc}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="card set">
          <div>
            <h2>Estoque</h2>
            <p className="desc">Opcional.</p>
          </div>
          <div className="toggle-row">
            <Switch
              checked={controlaEstoque ?? false}
              onChange={(v) => setDraft((d) => ({ ...d, controlaEstoque: v }))}
              label="Controlar estoque"
            />
            <div>
              <b>Controlar estoque</b>
              <span>Baixa a quantidade quando um orçamento aprovado vira atendimento e avisa antes de acabar.</span>
            </div>
          </div>
        </section>

        {/* não está no template: a API já guarda esta opção e o app do técnico respeita */}
        <section className="card set">
          <div>
            <h2>Serviço novo em campo</h2>
            <p className="desc">Vale para o app do técnico em campo.</p>
          </div>
          <div className="toggle-row">
            <Switch
              checked={agenteCadastraServico ?? false}
              onChange={(v) => setDraft((d) => ({ ...d, agenteCadastraServico: v }))}
              label="Técnico cadastra serviço"
            />
            <div>
              <b>Técnico cadastra serviço</b>
              <span>Serviço fora do catálogo pode ser criado no app. Ele aparece em Serviços como "a revisar".</span>
            </div>
          </div>
        </section>

        {/* a API ainda não guarda nome, cidade e telefone da empresa: campos só de leitura */}
        <section className="card set">
          <div>
            <h2>
              Empresa <Badge tone="future">Futuro</Badge>
            </h2>
            <p className="desc">Aparece nos orçamentos.</p>
          </div>
          <div className="fields">
            <div className="field">
              <label htmlFor="f-nome">Nome</label>
              <input className="input" id="f-nome" placeholder="—" disabled />
            </div>
            <div className="field">
              <label htmlFor="f-cidade">Cidade</label>
              <input className="input" id="f-cidade" placeholder="—" disabled />
            </div>
            <div className="field">
              <label htmlFor="f-email">E-mail de acesso</label>
              <input className="input" id="f-email" type="email" value={user?.email ?? ''} placeholder="—" readOnly disabled />
            </div>
            <div className="field">
              <label htmlFor="f-tel">Telefone</label>
              <input className="input" id="f-tel" placeholder="(34) 90000-0000" disabled />
              <span className="hint">Usado no envio de orçamento por WhatsApp (futuro).</span>
            </div>
          </div>
        </section>

        <div className={`savebar${dirty ? ' pendente' : ''}`}>
          <span className="hint">Alterações salvas valem na hora para toda a equipe.</span>
          <Button variant="ghost" type="reset" disabled={!dirty || update.isPending}>
            Descartar
          </Button>
          <Button variant="primary" type="submit" icon="check" disabled={!podeSalvar}>
            {update.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </>
  )
}
