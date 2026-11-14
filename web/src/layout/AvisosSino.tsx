import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { useAvisos } from '../lib/queries'
import { dataCurta, hora } from '../lib/format'
import { chaveDoDia } from '../features/agenda/mapa'
import type { AgendaItem } from '../types/api'

/**
 * Sino do topo: os atendimentos pendentes de hoje e os atrasados (pendentes de dias
 * anteriores que ninguém concluiu nem cancelou). Cada um abre a Agenda no dia dele.
 * Atualiza a cada 5 minutos e ao voltar à aba.
 */
export function AvisosSino() {
  const avisos = useAvisos()
  const navigate = useNavigate()
  const [aberto, setAberto] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // fecha no clique fora e no Esc
  useEffect(() => {
    if (!aberto) return
    const fora = (e: globalThis.MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setAberto(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('click', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('click', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  const hoje = avisos.data?.hoje ?? []
  const atrasados = avisos.data?.atrasados ?? []
  const totalAtrasados = avisos.data?.totalAtrasados ?? 0
  const total = hoje.length + totalAtrasados

  function abrir(a: AgendaItem) {
    setAberto(false)
    navigate(`/agenda?dia=${chaveDoDia(a.dataAgendada!)}`)
  }

  const rotulo =
    total === 0
      ? 'Notificações: nenhum atendimento pendente'
      : `Notificações: ${hoje.length} pendente${hoje.length === 1 ? '' : 's'} hoje, ${totalAtrasados} atrasado${totalAtrasados === 1 ? '' : 's'}`

  return (
    <div className={`avisos-wrap${aberto ? ' open' : ''}`} ref={wrapRef}>
      <button
        className="icon-btn"
        type="button"
        aria-label={rotulo}
        aria-expanded={aberto}
        aria-haspopup="true"
        onClick={() => setAberto((v) => !v)}
      >
        <Icon name="bell" />
        {total > 0 && <span className="badge">{total > 99 ? '99+' : total}</span>}
      </button>
      <div className="avisos" role="dialog" aria-label="Avisos da agenda">
        <div className="avisos-title">Hoje</div>
        {avisos.isLoading ? (
          <p className="avisos-vazio">Carregando…</p>
        ) : avisos.isError ? (
          <p className="avisos-vazio">Não foi possível carregar os avisos.</p>
        ) : hoje.length === 0 ? (
          <p className="avisos-vazio">Nenhum atendimento pendente hoje.</p>
        ) : (
          hoje.map((a) => (
            <button key={a.id} type="button" onClick={() => abrir(a)}>
              <b>{hora(a.dataAgendada!)}</b>
              <span>
                {a.clienteNome}
                <span className="sub">{a.resumo}</span>
              </span>
            </button>
          ))
        )}
        {atrasados.length > 0 && (
          <>
            <div className="avisos-title atrasados">
              Atrasados{totalAtrasados > atrasados.length ? ` (${atrasados.length} de ${totalAtrasados})` : ''}
            </div>
            {atrasados.map((a) => (
              <button key={a.id} type="button" onClick={() => abrir(a)}>
                <b>{dataCurta(a.dataAgendada)}</b>
                <span>
                  {a.clienteNome}
                  <span className="sub">{a.resumo}</span>
                </span>
              </button>
            ))}
          </>
        )}
        <hr />
        <button
          type="button"
          className="avisos-agenda"
          onClick={() => {
            setAberto(false)
            navigate('/agenda')
          }}
        >
          Abrir a agenda
        </button>
      </div>
    </div>
  )
}
