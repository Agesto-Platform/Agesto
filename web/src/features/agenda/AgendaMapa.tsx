import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { PontoMapa } from './mapa'

// Carregado só quando a aba Mapa abre (React.lazy), para não pesar o bundle.
// Mapa do OpenStreetMap; o CSP do painel libera tile.openstreetmap.org (DEC-38).
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATRIBUICAO = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

function hora(iso: string | null): string {
  return iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'
}

export interface AgendaMapaProps {
  pontos: PontoMapa[]
  cores: Map<number, string>
  nomeResponsavel: (usuarioId: number) => string
}

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
      const cor = cores.get(p.item.usuarioId) ?? '#243FA6'
      const icone = L.divIcon({
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
        html: `<span style="display:grid;place-items:center;width:28px;height:28px;border-radius:9999px;background:${cor};color:#fff;font:700 13px/1 system-ui,sans-serif;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${p.ordem}</span>`,
      })
      L.marker([p.latitude, p.longitude], { icon: icone, title: `${p.ordem}. ${p.item.clienteNome}` })
        .bindPopup(
          `<strong>${hora(p.item.dataAgendada)} · ${escapar(p.item.clienteNome)}</strong><br>` +
            `${escapar(p.item.resumo)}<br>` +
            (p.item.enderecoResumo ? `<span style="color:#667">${escapar(p.item.enderecoResumo)}</span><br>` : '') +
            `<span style="color:#667">Com ${escapar(nomeResponsavel(p.item.usuarioId))}</span>`,
        )
        .addTo(grupo)
    }
    if (pontos.length === 1) m.setView([pontos[0].latitude, pontos[0].longitude], 15)
    else if (pontos.length > 1) m.fitBounds(L.latLngBounds(pontos.map((p) => [p.latitude, p.longitude])), { padding: [36, 36] })
  }, [pontos, cores, nomeResponsavel])

  return <div ref={el} className="h-[460px] w-full rounded-card" aria-label="Mapa das visitas do dia" role="region" />
}
