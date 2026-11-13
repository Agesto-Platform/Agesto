import { Icon } from '../../components/Icon'
import { avisoAssinatura } from '../../lib/assinatura'
import { useAssinatura } from './queries'
import { CONTATO } from '../../pages/venda/oferta'
import { linkWhatsApp } from '../../lib/whatsapp'

/**
 * Aviso no topo do painel quando a assinatura vence em breve ou está na
 * carência dos 10 dias (DEC-58). Some quando está em dia ou sem cobrança.
 */
export function AvisoAssinatura() {
  const assinatura = useAssinatura()
  const aviso = assinatura.data ? avisoAssinatura(assinatura.data) : null
  if (!aviso) return null
  const whats = linkWhatsApp(CONTATO.whatsapp, 'Olá! Quero regularizar a assinatura do Agesto.')
  return (
    <div className={`aviso-assinatura${aviso.grave ? ' grave' : ''}`} role="status">
      <Icon name={aviso.grave ? 'alert' : 'clock'} className="sm" />
      <span>{aviso.texto}</span>
      {whats && (
        <a href={whats} target="_blank" rel="noopener noreferrer">
          Falar com o Agesto
        </a>
      )}
    </div>
  )
}
