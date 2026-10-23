import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { ShellContext } from '../../layout/AppShell'
import { PeriodSwitch, type Period } from '../../layout/PeriodSwitch'
import { Button, CardHead, Drawer, Empty, IconButton, PageHead, Seg, brl, useToast } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { useAgenda } from '../../lib/queries'
import { agendaRange } from '../../lib/period'
import { ApiError } from '../../lib/api'
import { hora, mesNome, MES_LONGO, SEMANA_CURTA } from '../../lib/format'
import { useUsuarios, nomeUsuario, responsaveis } from '../usuarios/queries'
import { useConfiguracao } from '../parametrizacao/queries'
import { useCreateAtendimento } from '../atendimentos/queries'
import { AtendimentoForm } from '../atendimentos/AtendimentoForm'
import { StatusAtendimentoPill } from '../atendimentos/status'
import { clientesResource } from '../clientes/resource'
import type { AgendaItem, AtendimentoInput, ModoAgendaAgente } from '../../types/api'
import { chaveDoDia, coresPorResponsavel, diaInicial, diasComVisitas, pontosDoDia } from './mapa'
import './agenda.css'

const AgendaMapa = lazy(() => import('./AgendaMapa'))

type Filtro = 'todos' | 'Pendente' | 'Concluido'
type Visao = 'calendario' | 'mapa'

const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'Pendente', label: 'Pendentes' },
  { value: 'Concluido', label: 'Concluídos' },
]

const VISOES: { value: Visao; label: string }[] = [
  { value: 'calendario', label: 'Calendário' },
  { value: 'mapa', label: 'Mapa' },
]

const SEMANA_TOPO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const MODO: Record<ModoAgendaAgente, string> = {
  Flexivel: 'Modo Flexível: você mesmo agenda em campo.',
  Fixa: 'Modo Fixo: a equipe segue a agenda montada por você.',
}

/** "em outubro" / "nos próximos 7 dias" / "em 2026". */
function noPeriodo(period: Period, hoje = new Date()): string {
  if (period === '7d') return 'nos próximos 7 dias'
  if (period === 'ano') return `em ${hoje.getFullYear()}`
  return `em ${MES_LONGO[hoje.getMonth()]}`
}

/** "2026-10-20" -> Date local. */
function dataDaChave(k: string): Date {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

/** "2026-10-20" -> "2026-10". */
const chaveMes = (k: string) => k.slice(0, 7)

function somaMes(mes: string, delta: number): string {
  const [y, m] = mes.split('-').map(Number)
  return chaveMes(chaveDoDia(new Date(y!, m! - 1 + delta, 1)))
}

/** "Hoje · ter, 20 de outubro" */
function tituloDia(k: string, hojeK: string): string {
  const d = dataDaChave(k)
  return (k === hojeK ? 'Hoje · ' : '') + SEMANA_CURTA[d.getDay()]!.replace('.', '') + ', ' + d.getDate() + ' de ' + MES_LONGO[d.getMonth()]
}

const porHorario = (a: AgendaItem, b: AgendaItem) => a.dataAgendada!.localeCompare(b.dataAgendada!)

export function AgendaPage() {
  const { period, setPeriod } = useOutletContext<ShellContext>()
  const { data, isLoading, isError, error } = useAgenda(period)
  const usuarios = useUsuarios()
  const config = useConfiguracao()
  const toast = useToast()

  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [agente, setAgente] = useState('')
  const [visao, setVisao] = useState<Visao>('calendario')

  // Só mostra o seletor de equipe quando há mais de uma pessoa recebendo atendimentos.
  const pessoas = (usuarios.data ?? []).filter((u) => u.ativo)
  const variasPessoas = pessoas.length > 1
  const nomeResponsavel = useCallback((id: number) => nomeUsuario(usuarios.data, id), [usuarios.data])

  // Janela carregada (o período da topbar): os dias fora dela ficam apagados no calendário.
  const [hojeK] = useState(() => chaveDoDia(new Date()))
  const { de, ate } = agendaRange(period)
  const deK = chaveDoDia(de)
  const ateK = chaveDoDia(ate)
  const dentro = (k: string) => k >= deK && k <= ateK

  const [selEscolhido, setSel] = useState(hojeK)
  const sel = dentro(selEscolhido) ? selEscolhido : hojeK
  const [mesEscolhido, setMes] = useState(chaveMes(hojeK))
  const mes =
    mesEscolhido < chaveMes(deK) ? chaveMes(deK) : mesEscolhido > chaveMes(ateK) ? chaveMes(ateK) : mesEscolhido

  const filtrados = useMemo(
    () =>
      (data ?? [])
        .filter((i) => i.dataAgendada)
        .filter((i) => (filtro === 'todos' ? true : i.status === filtro))
        .filter((i) => (agente ? i.usuarioId === Number(agente) : true))
        .sort(porHorario),
    [data, filtro, agente],
  )
  const porDia = useMemo(() => {
    const m = new Map<string, AgendaItem[]>()
    for (const i of filtrados) {
      const k = chaveDoDia(i.dataAgendada!)
      const lista = m.get(k)
      if (lista) lista.push(i)
      else m.set(k, [i])
    }
    return m
  }, [filtrados])

  // Mapa (DEC-38): o dia escolhido, pinos numerados pela ordem dos horários.
  const dias = useMemo(() => diasComVisitas(filtrados), [filtrados])
  const { pontos, semLocal } = useMemo(() => pontosDoDia(filtrados, sel), [filtrados, sel])
  const cores = useMemo(() => coresPorResponsavel(filtrados), [filtrados])
  const responsaveisDoDia = [...new Set(pontos.map((p) => p.item.usuarioId))]

  function escolherDia(k: string) {
    setSel(k)
    setMes(chaveMes(k))
  }
  function trocarVisao(v: Visao) {
    setVisao(v)
    // como antes: o mapa abre em hoje, ou no próximo dia com visita
    if (v === 'mapa' && !porDia.has(sel)) {
      const d = diaInicial(dias)
      if (d) escolherDia(d)
    }
  }

  // Agendar: mesmo formulário de "Novo atendimento".
  const clientes = clientesResource.useList()
  const create = useCreateAtendimento()
  const qc = useQueryClient()
  const [agendarAberto, setAgendarAberto] = useState(false)
  const [erroServidor, setErroServidor] = useState<string | null>(null)
  function abrirAgendar() {
    setErroServidor(null)
    setAgendarAberto(true)
  }
  function agendar(input: AtendimentoInput) {
    setErroServidor(null)
    create.mutate(input, {
      onSuccess: () => {
        setAgendarAberto(false)
        void qc.invalidateQueries({ queryKey: ['agenda'] })
        toast.success('Atendimento agendado.')
      },
      onError: (e) => setErroServidor(e instanceof ApiError ? e.message : 'Erro ao agendar.'),
    })
  }

  const total = filtrados.length
  const sub = [
    config.data ? MODO[config.data.modoAgendaAgente] : null,
    isLoading || isError ? null : `${total} atendimento${total === 1 ? '' : 's'} ${noPeriodo(period)}.`,
  ]
    .filter(Boolean)
    .join(' ')

  // ---------- calendário do mês ----------
  const [ano, mesNum] = mes.split('-').map(Number) as [number, number]
  const inicioMes = new Date(ano, mesNum - 1, 1)
  const primeiro = inicioMes.getDay()
  const diasNoMes = new Date(ano, mesNum, 0).getDate()
  const diasMesAnterior = new Date(ano, mesNum - 1, 0).getDate()
  const resto = (7 - ((primeiro + diasNoMes) % 7)) % 7
  const podeVoltarMes = mes > chaveMes(deK)
  const podeAvancarMes = mes < chaveMes(ateK)
  const dicaMes = 'Troque o período (7 dias / Mês / Ano) para ver outros meses'

  const filtros = (
    <div className="toolbar cal-filters">
      {variasPessoas && (
        <select
          className="select"
          value={agente}
          onChange={(e) => setAgente(e.target.value)}
          aria-label="Filtrar por responsável"
        >
          <option value="">Toda a equipe</option>
          {pessoas.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
      )}
      <Seg label="Filtrar por status" options={FILTROS} value={filtro} onChange={setFiltro} />
    </div>
  )

  const calendario = (
    <section className="card">
      <div className="cal-head">
        <h2>
          {mesNome(inicioMes)} de {ano}
        </h2>
        <IconButton
          aria-label="Mês anterior"
          disabled={!podeVoltarMes}
          title={podeVoltarMes ? undefined : dicaMes}
          onClick={() => setMes(somaMes(mes, -1))}
        >
          <Icon name="left" />
        </IconButton>
        <IconButton
          aria-label="Próximo mês"
          disabled={!podeAvancarMes}
          title={podeAvancarMes ? undefined : dicaMes}
          onClick={() => setMes(somaMes(mes, 1))}
        >
          <Icon name="right" />
        </IconButton>
        <Button size="sm" onClick={() => escolherDia(hojeK)}>
          Hoje
        </Button>
        <div className="legend">
          <span>
            <i />
            Pendente
          </span>
          <span>
            <i className="ok" />
            Concluído
          </span>
          <span>
            <i className="neg" />
            Cancelado
          </span>
        </div>
      </div>
      {filtros}
      <div className="wk" aria-hidden="true">
        {SEMANA_TOPO.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      <div className="month">
        {Array.from({ length: primeiro }, (_, i) => (
          <div key={`a${i}`} className="day off">
            <span className="n">{diasMesAnterior - primeiro + 1 + i}</span>
          </div>
        ))}
        {Array.from({ length: diasNoMes }, (_, i) => {
          const d = i + 1
          const k = `${mes}-${String(d).padStart(2, '0')}`
          if (!dentro(k)) {
            return (
              <div key={k} className="day off" title="Fora do período escolhido">
                <span className="n">{d}</span>
              </div>
            )
          }
          const evs = porDia.get(k) ?? []
          return (
            <button
              key={k}
              type="button"
              className={`day${k === hojeK ? ' today' : ''}`}
              aria-pressed={k === sel}
              aria-label={`${d} de ${MES_LONGO[mesNum - 1]}, ${evs.length} atendimento(s)`}
              onClick={() => setSel(k)}
            >
              <span className="n">{d}</span>
              {evs.map((a) => (
                <span key={a.id} className={`ev ${a.status}`} title={`${hora(a.dataAgendada!)} · ${a.clienteNome} · ${a.resumo}`}>
                  <b>{hora(a.dataAgendada!)}</b>
                  <span className="nm">{a.clienteNome}</span>
                </span>
              ))}
            </button>
          )
        })}
        {Array.from({ length: resto }, (_, i) => (
          <div key={`p${i}`} className="day off">
            <span className="n">{i + 1}</span>
          </div>
        ))}
      </div>
    </section>
  )

  const diaAnterior = [...dias].reverse().find((d) => d < sel)
  const diaSeguinte = dias.find((d) => d > sel)
  const doDia = porDia.get(sel) ?? []

  const mapa = (
    <section className="card">
      <div className="cal-head">
        <h2>{tituloDia(sel, hojeK)}</h2>
        <IconButton
          aria-label="Dia anterior com visita"
          disabled={!diaAnterior}
          onClick={() => diaAnterior && escolherDia(diaAnterior)}
        >
          <Icon name="left" />
        </IconButton>
        <IconButton
          aria-label="Próximo dia com visita"
          disabled={!diaSeguinte}
          onClick={() => diaSeguinte && escolherDia(diaSeguinte)}
        >
          <Icon name="right" />
        </IconButton>
        <Button size="sm" onClick={() => escolherDia(hojeK)}>
          Hoje
        </Button>
        {responsaveisDoDia.length > 0 && (
          <div className="legend" aria-label="Responsáveis">
            {responsaveisDoDia.map((id) => (
              <span key={id}>
                <i style={{ background: cores.get(id)?.fundo }} />
                {nomeResponsavel(id)}
              </span>
            ))}
          </div>
        )}
      </div>
      {filtros}
      {pontos.length > 0 ? (
        <Suspense
          fallback={
            <div className="agenda-map empty">
              <p>Carregando mapa…</p>
            </div>
          }
        >
          <AgendaMapa pontos={pontos} cores={cores} nomeResponsavel={nomeResponsavel} />
        </Suspense>
      ) : (
        <Empty icon="pin" title={doDia.length ? 'Nenhuma visita com localização' : 'Nenhuma visita neste dia'}>
          {doDia.length
            ? 'Os endereços dos clientes são localizados automaticamente depois de salvos.'
            : 'Use as setas para ir a um dia com visita.'}
        </Empty>
      )}
      {semLocal.length > 0 && (
        <p className="hint map-foot">
          Sem localização: {semLocal.map((i) => i.clienteNome).join(', ')}. Confira o endereço no cadastro do cliente.
        </p>
      )}
    </section>
  )

  // ---------- lista do dia ----------
  const proximo = filtrados.find((a) => a.status === 'Pendente' && chaveDoDia(a.dataAgendada!) > sel)
  const proximoTexto = (() => {
    if (!proximo) return 'Sem atendimentos pendentes depois deste dia.'
    const d = new Date(proximo.dataAgendada!)
    const mesmoMes = chaveMes(chaveDoDia(d)) === chaveMes(sel)
    const dia = mesmoMes ? `${d.getDate()}` : `${d.getDate()} de ${MES_LONGO[d.getMonth()]}`
    return `Próximo: ${proximo.resumo} com ${proximo.clienteNome}, dia ${dia} às ${hora(d)}.`
  })()

  let listaDoDia
  if (isLoading) {
    listaDoDia = (
      <p className="hint" style={{ margin: 0, padding: '20px 0', textAlign: 'center' }}>
        Carregando agenda…
      </p>
    )
  } else if (isError) {
    listaDoDia = (
      <Empty icon="alert" title="Não foi possível carregar a agenda" style={{ padding: '20px 8px' }}>
        {error instanceof ApiError ? error.message : 'Tente de novo em instantes.'}
      </Empty>
    )
  } else if (doDia.length) {
    listaDoDia = doDia.map((a) => (
      <article key={a.id} className="appt">
        <div className="top">
          <span className="t">{hora(a.dataAgendada!)}</span>
          <StatusAtendimentoPill status={a.status} />
        </div>
        <h3>{a.resumo}</h3>
        <p>
          <Icon name="user" className="sm" />
          {a.clienteNome}
        </p>
        {a.enderecoResumo && (
          <p>
            <Icon name="pin" className="sm" />
            {a.enderecoResumo}
          </p>
        )}
        {a.clienteTelefone && (
          <p>
            <Icon name="phone" className="sm" />
            {a.clienteTelefone}
          </p>
        )}
        {variasPessoas && (
          <p>
            <Icon name="users" className="sm" />
            Com {nomeResponsavel(a.usuarioId)}
          </p>
        )}
        <div className="val">
          <span>Total</span>
          <b>{brl(a.valorTotal)}</b>
        </div>
      </article>
    ))
  } else {
    listaDoDia = (
      <div className="empty" style={{ padding: '20px 8px' }}>
        <span className="ic">
          <Icon name="calendar" />
        </span>
        <b>Nada marcado</b>
        <p>{proximoTexto}</p>
        <Button size="sm" icon="plus" style={{ marginTop: 6 }} onClick={abrirAgendar}>
          Agendar neste dia
        </Button>
      </div>
    )
  }

  return (
    <>
      <PageHead
        title="Agenda"
        sub={sub || undefined}
        actions={
          <>
            <Seg label="Visualização" options={VISOES} value={visao} onChange={trocarVisao} />
            <PeriodSwitch value={period} onChange={setPeriod} />
            <Button variant="primary" icon="plus" onClick={abrirAgendar}>
              Agendar
            </Button>
          </>
        }
      />

      <div className="agenda">
        {visao === 'mapa' ? mapa : calendario}

        <section className="card" aria-live="polite">
          <CardHead
            title={tituloDia(sel, hojeK)}
            subtitle={isLoading ? 'Carregando…' : doDia.length ? `${doDia.length} ${doDia.length > 1 ? 'atendimentos' : 'atendimento'}` : 'Dia livre'}
          />
          <div className="card-body">
            <div className="day-list">{listaDoDia}</div>
          </div>
        </section>
      </div>

      <Drawer
        open={agendarAberto}
        onClose={() => setAgendarAberto(false)}
        title="Agendar atendimento"
        sub="Cliente, responsável e quando vai ser."
      >
        {agendarAberto && (
          <AtendimentoForm
            clientes={clientes.data ?? []}
            responsaveis={responsaveis(usuarios.data)}
            onSubmit={agendar}
            submitting={create.isPending}
            serverError={erroServidor}
            onCancel={() => setAgendarAberto(false)}
          />
        )}
      </Drawer>
    </>
  )
}
