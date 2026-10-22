import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { hora } from '../../lib/format'
import { CORES_RESPONSAVEL, type CorResponsavel, type PontoMapa } from './mapa'

// Carregado só quando a visão Mapa abre (React.lazy), para não pesar o bundle.
// Mapa do OpenStreetMap; o CSP do painel libera tile.openstreetmap.org (DEC-38).
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATRIBUICAO = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

export interface AgendaMapaProps {
  pontos: PontoMapa[]
  cores: Map<number, CorResponsavel>
  nomeResponsavel: (usuarioId: number) => string
}

/*
 * As cores do pino e do balão saem dos tokens (var(--brand), var(--surface)...).
 * Como o HTML do marcador vive dentro da página, as variáveis resolvem na hora
 * e acompanham a troca de paleta e o modo escuro sem redesenhar o mapa.
 */
export default function AgendaMapa({ pontos, cores, nomeResponsavel }: AgendaMapaProps) {
  const el = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const camada = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!el.current) return
    const m = L.map(el.current, { scrollWheelZoom: false })
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATRIBUICAO }).addTo(m)
    m.setView([-15.78, -47.93], 4) // Brasil, até os pontos chegarem
    mapa.current = m
    camada.current = L.layerGroup().addTo(m)
    return () => {
      m.remove()
      mapa.current = null
    }
  }, [])

  useEffect(() => {
    const m = mapa.current
    const grupo = camada.current
    if (!m || !grupo) return
    grupo.clearLayers()
    for (const p of pontos) {
      const cor = cores.get(p.item.usuarioId) ?? CORES_RESPONSAVEL[0]!
      const icone = L.divIcon({
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
        html: `<span class="map-pin" style="background:${cor.fundo};color:${cor.texto}">${p.ordem}</span>`,
      })
      L.marker([p.latitude, p.longitude], { icon: icone, title: `${p.ordem}. ${p.item.clienteNome}` })
        .bindPopup(
          `<b>${p.item.dataAgendada ? hora(p.item.dataAgendada) : '--:--'} · ${escapar(p.item.clienteNome)}</b>` +
            `<span>${escapar(p.item.resumo)}</span>` +
            (p.item.enderecoResumo ? `<span class="muted">${escapar(p.item.enderecoResumo)}</span>` : '') +
            `<span class="muted">Com ${escapar(nomeResponsavel(p.item.usuarioId))}</span>`,
          { className: 'map-pop' },
        )
        .addTo(grupo)
    }
    if (pontos.length === 1) m.setView([pontos[0]!.latitude, pontos[0]!.longitude], 15)
    else if (pontos.length > 1) m.fitBounds(L.latLngBounds(pontos.map((p) => [p.latitude, p.longitude])), { padding: [36, 36] })
  }, [pontos, cores, nomeResponsavel])

  return <div ref={el} className="agenda-map" aria-label="Mapa das visitas do dia" role="region" />
}
