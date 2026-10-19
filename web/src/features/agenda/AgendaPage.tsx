import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { ShellContext } from '../../layout/AppShell'
import { Card, Money, Pill } from '../../components/ui'
import { useAgenda } from '../../lib/queries'
import { useUsuarios, nomeUsuario } from '../usuarios/queries'
import { ApiError } from '../../lib/api'
import type { AgendaItem, StatusAtendimento } from '../../types/api'

const STATUS: Record<
  StatusAtendimento,
  { tone: 'ok' | 'pend' | 'bad'; label: string; dot: string }
> = {
  Concluido: { tone: 'ok', label: 'Concluído', dot: 'bg-good' },
  Pendente: { tone: 'pend', label: 'Pendente', dot: 'bg-warn' },
  Cancelado: { tone: 'bad', label: 'Cancelado', dot: 'bg-bad' },
}

type Filtro = 'todos' | 'Pendente' | 'Concluido'

const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'Pendente', label: 'Pendentes' },
  { value: 'Concluido', label: 'Concluídos' },
]

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}
function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** Agrupa itens (já ordenados por data) por dia, preservando a ordem. */
function groupByDay(items: AgendaItem[]): { key: string; label: string; items: AgendaItem[] }[] {
  const groups: { key: string; label: string; items: AgendaItem[] }[] = []
  for (const item of items) {
    if (!item.dataAgendada) continue
    const key = dayKey(item.dataAgendada)
    let group = groups.find((g) => g.key === key)
    if (!group) {
      group = { key, label: dayLabel(item.dataAgendada), items: [] }
      groups.push(group)
    }
    group.items.push(item)
  }
  return groups
}

export function AgendaPage() {
  const { period } = useOutletContext<ShellContext>()
  const { data, isLoading, isError, error } = useAgenda(period)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [agente, setAgente] = useState('')
  const usuarios = useUsuarios()
  // Só mostra o seletor quando há mais de uma pessoa recebendo atendimentos.
  const pessoas = (usuarios.data ?? []).filter((u) => u.ativo)

  const filtered = (data ?? [])
    .filter((i) => (filtro === 'todos' ? true : i.status === filtro))
    .filter((i) => (agente ? i.usuarioId === Number(agente) : true))
  const groups = groupByDay(filtered)

  return (
    <>
      <Card className="shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Agenda</h2>
            <p className="text-[12.5px] text-ink-3">
              {filtered.length} atendimento{filtered.length === 1 ? '' : 's'} no período
            </p>
          </div>
          <div className="flex items-center gap-2">
          {pessoas.length > 1 && (
            <select
              value={agente}
              onChange={(e) => setAgente(e.target.value)}
              aria-label="Filtrar por responsável"
              className="rounded-[10px] border border-line bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink-2 outline-none focus:border-brand"
            >
              <option value="">Toda a equipe</option>
              {pessoas.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          )}
          <div className="flex rounded-[10px] border border-line bg-surface-2 p-[3px]">
            {FILTROS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFiltro(f.value)}
                className={`rounded-[7px] px-3 py-1.5 text-[12.5px] font-semibold transition ${
                  filtro === f.value
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-3 hover:text-ink-2'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          </div>
        </div>
      </Card>

      {isLoading && (
        <Card className="shadow-card">
          <p className="py-6 text-center text-[13px] text-ink-3">Carregando agenda…</p>
        </Card>
      )}

      {isError && (
        <Card className="shadow-card">
          <p className="py-6 text-center text-[13px] text-bad">
            Não foi possível carregar a agenda
            {error instanceof ApiError ? `: ${error.message}` : '.'}
          </p>
        </Card>
      )}

      {!isLoading && !isError && groups.length === 0 && (
        <Card className="shadow-card">
          <p className="py-8 text-center text-[13px] text-ink-3">
            Nenhum atendimento agendado neste período.
          </p>
        </Card>
      )}

      {groups.map((group) => (
        <div key={group.key}>
          <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-4">
            {group.label}
          </div>
          <Card className="shadow-card !p-0">
            {group.items.map((item) => {
              const st = STATUS[item.status]
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 border-b border-line-2 px-[18px] py-3 last:border-0"
                >
                  <div className="w-12 flex-none pt-0.5 text-right">
                    <span className="money text-[13px] tabular-nums text-ink-2">
                      {item.dataAgendada ? timeLabel(item.dataAgendada) : '--:--'}
                    </span>
                  </div>
                  <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${st.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink">{item.resumo}</div>
                    <div className="text-[12.5px] text-ink-2">
                      {item.clienteNome}
                      {item.clienteTelefone ? ` · ${item.clienteTelefone}` : ''}
                    </div>
                    {item.enderecoResumo && (
                      <div className="text-[12px] text-ink-3">{item.enderecoResumo}</div>
                    )}
                    {pessoas.length > 1 && (
                      <div className="text-[12px] text-ink-4">
                        Com {nomeUsuario(usuarios.data, item.usuarioId)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-none flex-col items-end gap-1">
                    <Pill tone={st.tone}>{st.label}</Pill>
                    <Money value={item.valorTotal} />
                  </div>
                </div>
              )
            })}
          </Card>
        </div>
      ))}
    </>
  )
}
