import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { Icon, type IconName } from '../../components/Icon'
import { linkWhatsApp } from '../../lib/whatsapp'
import { CONTATO, PRECO, licencasExtras, reais, totalMensal } from './oferta'
import './venda.css'

/**
 * Página de venda do Agesto (DEC-57): quem não está logado e abre a raiz do web
 * cai aqui. Não há cadastro aberto; a assinatura começa pelo contato, e a equipe
 * cria a empresa no superadmin (convite por email, DEC-55). Sempre no modo claro.
 */

const ANO = new Date().getFullYear()

function whats(texto: string): string {
  return linkWhatsApp(CONTATO.whatsapp, texto) ?? `mailto:${CONTATO.email}`
}

const RECURSOS: { icon: IconName; titulo: string; texto: string }[] = [
  { icon: 'file', titulo: 'Orçamentos em PDF', texto: 'Monte o orçamento em minutos e mande o PDF pelo WhatsApp do cliente.' },
  { icon: 'calendar', titulo: 'Agenda da equipe', texto: 'Veja quem vai aonde e quando, no calendário ou no mapa, com a rota pronta.' },
  { icon: 'wrench', titulo: 'Atendimento no celular', texto: 'Sua equipe registra o serviço no app, mesmo sem internet, e tudo chega ao painel.' },
  { icon: 'users', titulo: 'Clientes com histórico', texto: 'Endereço, telefone e tudo o que já foi feito para cada cliente, num clique.' },
  { icon: 'box', titulo: 'Estoque que se atualiza', texto: 'O material usado no atendimento sai do estoque sozinho. Sem conta de cabeça.' },
  { icon: 'trend', titulo: 'Quanto sobrou de verdade', texto: 'Faturamento, custo e margem por serviço, para saber o que dá lucro.' },
  { icon: 'lock', titulo: 'Cada um com seu acesso', texto: 'Você no comando do painel; cada funcionário entra com o próprio login.' },
  { icon: 'sparkle', titulo: 'Assistente com IA', texto: 'Pergunte "quanto sobrou este mês?" e receba a resposta com os seus números.' },
]

const FLUXO = ['Orçamento', 'Aprovado', 'Atendimento', 'Estoque', 'Resultado']

const PERGUNTAS: { p: string; r: string }[] = [
  {
    p: 'Preciso instalar alguma coisa?',
    r: 'Você usa o painel no navegador, do computador ou do celular. Sua equipe usa o app do Agesto no Android.',
  },
  {
    p: 'Funciona onde não tem internet?',
    r: 'Sim. O app registra o atendimento no aparelho e envia tudo quando o sinal volta.',
  },
  {
    p: 'Como eu assino?',
    r: 'Fale com a gente pelo WhatsApp ou por email. Combinamos o plano e a forma de pagamento (cartão de crédito, boleto ou Pix), criamos a conta da sua empresa e você recebe um email para criar a sua senha.',
  },
  {
    p: 'Quem vê os meus dados?',
    r: 'Só a sua empresa. Cada empresa enxerga apenas os próprios dados, conforme os nossos termos e a política de privacidade.',
  },
]

export function PaginaDeVenda() {
  const [funcionarios, setFuncionarios] = useState(2)

  useEffect(() => {
    const anterior = document.title
    document.title = 'Agesto · Sua empresa inteira em um lugar só'
    return () => {
      document.title = anterior
    }
  }, [])

  const quero = whats('Olá! Quero conhecer o Agesto.')
  const assinar = whats(
    `Olá! Quero assinar o Agesto${funcionarios > 0 ? ` com ${funcionarios} ${funcionarios === 1 ? 'funcionário' : 'funcionários'}` : ''}.`,
  )

  return (
    <div className="venda" data-palette="marinho" data-mode="light">
      <header className="v-top">
        <div className="v-wrap v-top-in">
          <a className="v-marca" href="#inicio" aria-label="Agesto, início">
            <Logo />
            Agesto
          </a>
          <nav className="v-nav" aria-label="Seções">
            <a href="#recursos">Recursos</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#precos">Preços</a>
            <a href="#contato">Contato</a>
          </nav>
          <div className="v-top-acoes">
            <Link className="btn" to="/login">
              Entrar
            </Link>
            <a className="btn accent v-so-desktop" href={quero} target="_blank" rel="noopener noreferrer">
              Fale conosco
            </a>
          </div>
        </div>
      </header>

      <main id="inicio">
        <section className="v-hero">
          <div className="v-wrap v-hero-in">
            <div className="v-hero-txt">
              <span className="v-selo">Gestão para prestadores de serviço</span>
              <h1>
                Sua empresa inteira em <em>um lugar só</em>.
              </h1>
              <p className="v-lead">
                Orçamentos, agenda, atendimentos, clientes, estoque e equipe no mesmo sistema. Chega de pular entre
                caderno, planilha e conversa perdida no WhatsApp.
              </p>
              <div className="v-ctas">
                <a className="btn accent v-cta" href={quero} target="_blank" rel="noopener noreferrer">
                  <Icon name="whats" />
                  Quero o Agesto
                </a>
                <a className="btn v-cta" href="#precos">
                  Ver preços
                </a>
              </div>
              <ul className="v-confianca">
                <li>
                  <Icon name="check" /> Painel web para o dono
                </li>
                <li>
                  <Icon name="check" /> App Android para a equipe
                </li>
                <li>
                  <Icon name="check" /> Funciona sem internet no campo
                </li>
              </ul>
            </div>

            <div className="v-mock" aria-hidden="true">
              <div className="v-mock-bar">
                <span />
                <span />
                <span />
                <b>Visão geral</b>
              </div>
              <div className="v-mock-kpis">
                <div>
                  <small>Faturado no mês</small>
                  <strong>R$ 12.480</strong>
                  <i className="v-up">+18%</i>
                </div>
                <div>
                  <small>Atendimentos hoje</small>
                  <strong>6</strong>
                  <i>3 em rota</i>
                </div>
                <div>
                  <small>Margem</small>
                  <strong>41%</strong>
                  <i className="v-up">+4 pts</i>
                </div>
              </div>
              <div className="v-mock-grade">
                <div className="v-mock-agenda">
                  <small>Agenda de hoje</small>
                  {[
                    ['08:30', 'Instalação de ar', 'Ana Prado', 'ok'],
                    ['11:00', 'Manutenção preventiva', 'Condomínio Solar', 'agora'],
                    ['15:30', 'Visita técnica', 'Marcos Lima', ''],
                  ].map(([h, s, c, st]) => (
                    <div className={`v-mock-item ${st}`} key={h}>
                      <b>{h}</b>
                      <span>
                        {s}
                        <em>{c}</em>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="v-mock-graf">
                  <small>Últimos 6 meses</small>
                  <div className="v-barras">
                    {[42, 55, 48, 66, 72, 88].map((h, i) => (
                      <span key={i} style={{ height: `${h}%` }} className={i === 5 ? 'hi' : undefined} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="v-dor">
          <div className="v-wrap">
            <p className="v-dor-titulo">Hoje a sua empresa está espalhada assim?</p>
            <ul className="v-dor-lista">
              <li>
                <Icon name="x" /> Orçamento no bloco de notas
              </li>
              <li>
                <Icon name="x" /> Agenda no papel da geladeira
              </li>
              <li>
                <Icon name="x" /> Cliente perdido no WhatsApp
              </li>
              <li>
                <Icon name="x" /> Estoque "de cabeça"
              </li>
              <li>
                <Icon name="x" /> Lucro que ninguém sabe dizer
              </li>
            </ul>
            <p className="v-dor-resposta">
              Com o Agesto, tudo isso fica <b>em um lugar só</b>, e conversa entre si.
            </p>
          </div>
        </section>

        <section className="v-secao" id="recursos">
          <div className="v-wrap">
            <h2>Tudo o que a sua empresa precisa, junto</h2>
            <p className="v-sub">Do primeiro contato com o cliente até saber quanto sobrou no fim do mês.</p>
            <div className="v-recursos">
              {RECURSOS.map((r) => (
                <article key={r.titulo} className="v-recurso">
                  <span className="v-ic">
                    <Icon name={r.icon} />
                  </span>
                  <h3>{r.titulo}</h3>
                  <p>{r.texto}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="v-faixa">
          <div className="v-wrap">
            <h2>Um lugar só. Do orçamento ao resultado.</h2>
            <p>
              O orçamento aprovado vira atendimento na agenda. O atendimento baixa o estoque. Tudo cai no resultado
              do mês. Sem digitar a mesma coisa duas vezes.
            </p>
            <ol className="v-fluxo">
              {FLUXO.map((f, i) => (
                <li key={f}>
                  <span>{i + 1}</span>
                  {f}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="v-secao" id="como-funciona">
          <div className="v-wrap">
            <h2>Comece em três passos</h2>
            <div className="v-passos">
              <div>
                <span className="v-num">1</span>
                <h3>Fale com a gente</h3>
                <p>Chame no WhatsApp ou mande um email. Tiramos suas dúvidas e montamos a assinatura do seu tamanho.</p>
              </div>
              <div>
                <span className="v-num">2</span>
                <h3>Receba seu acesso</h3>
                <p>Criamos a conta da sua empresa e você recebe um email para criar a sua senha.</p>
              </div>
              <div>
                <span className="v-num">3</span>
                <h3>Traga sua equipe</h3>
                <p>Cadastre seus funcionários. Cada um recebe o convite e usa o app no celular.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="v-secao v-precos" id="precos">
          <div className="v-wrap">
            <h2>Preço simples, do tamanho da sua equipe</h2>
            <p className="v-sub">A assinatura já vem com o seu acesso e o de um funcionário. Cresceu a equipe? Some uma licença por pessoa.</p>
            <div className="v-planos">
              <article className="v-plano">
                <h3>Assinatura Agesto</h3>
                <p className="v-preco">
                  <b>{reais(PRECO.assinatura)}</b>
                  <span>/mês</span>
                </p>
                <ul>
                  <li>
                    <Icon name="check" /> Seu acesso de dono, com todos os recursos
                  </li>
                  <li>
                    <Icon name="check" /> <b>1 licença de funcionário inclusa</b>
                  </li>
                  <li>
                    <Icon name="check" /> Orçamentos, agenda, clientes, estoque e relatórios
                  </li>
                  <li>
                    <Icon name="check" /> Assistente com IA
                  </li>
                </ul>
              </article>
              <article className="v-plano">
                <h3>Funcionário a mais</h3>
                <p className="v-preco">
                  <b>{reais(PRECO.licenca)}</b>
                  <span>/mês cada</span>
                </p>
                <p className="v-nota">A partir do segundo funcionário.</p>
                <ul>
                  <li>
                    <Icon name="check" /> Login próprio para cada pessoa
                  </li>
                  <li>
                    <Icon name="check" /> App no celular, mesmo sem internet
                  </li>
                  <li>
                    <Icon name="check" /> Agenda e atendimentos do dia
                  </li>
                </ul>
              </article>
              <article className="v-plano v-calc">
                <h3>Faça a conta</h3>
                <label htmlFor="v-func">Quantos funcionários vão usar o app?</label>
                <div className="v-stepper">
                  <button
                    type="button"
                    aria-label="Menos um funcionário"
                    onClick={() => setFuncionarios((n) => Math.max(0, n - 1))}
                    disabled={funcionarios === 0}
                  >
                    −
                  </button>
                  <input
                    id="v-func"
                    inputMode="numeric"
                    value={funcionarios}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(/\D/g, '') || 0)
                      setFuncionarios(Math.min(99, n))
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Mais um funcionário"
                    onClick={() => setFuncionarios((n) => Math.min(99, n + 1))}
                  >
                    +
                  </button>
                </div>
                <p className="v-total" aria-live="polite">
                  <span>Total</span>
                  <b>{reais(totalMensal(funcionarios))}</b>
                  <span>/mês</span>
                </p>
                <p className="v-nota v-detalhe">
                  {licencasExtras(funcionarios) === 0
                    ? 'Só a assinatura: o seu acesso e o de 1 funcionário.'
                    : `Assinatura + ${licencasExtras(funcionarios)} ${licencasExtras(funcionarios) === 1 ? 'licença extra' : 'licenças extras'}.`}
                </p>
                <a className="btn accent v-cta" href={assinar} target="_blank" rel="noopener noreferrer">
                  <Icon name="whats" />
                  Quero assinar
                </a>
              </article>
            </div>
            <p className="v-pagamento">
              <Icon name="coins" /> Cartão de crédito, boleto ou Pix. A forma de pagamento é combinada no contato.
            </p>
          </div>
        </section>

        <section className="v-secao" id="duvidas">
          <div className="v-wrap v-estreito">
            <h2>Perguntas frequentes</h2>
            <div className="v-faq">
              {PERGUNTAS.map((q) => (
                <details key={q.p}>
                  <summary>{q.p}</summary>
                  <p>{q.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="v-final" id="contato">
          <div className="v-wrap">
            <h2>Organize sua empresa hoje.</h2>
            <p>Fale com a gente e veja o Agesto funcionando com a realidade do seu negócio.</p>
            <div className="v-ctas v-centro">
              <a className="btn accent v-cta" href={quero} target="_blank" rel="noopener noreferrer">
                <Icon name="whats" />
                Chamar no WhatsApp
              </a>
              <a className="btn v-cta v-claro" href={`mailto:${CONTATO.email}`}>
                <Icon name="mail" />
                {CONTATO.email}
              </a>
            </div>
            <p className="v-tel">WhatsApp {CONTATO.whatsapp}</p>
          </div>
        </section>
      </main>

      <footer className="v-rodape">
        <div className="v-wrap v-rodape-in">
          <span className="v-marca">
            <Logo />
            Agesto
          </span>
          <nav aria-label="Links do rodapé">
            <Link to="/login">Entrar</Link>
            <Link to="/baixar">Baixar o app</Link>
            <Link to="/termos">Termos de uso</Link>
            <Link to="/privacidade">Privacidade</Link>
          </nav>
          <small>© {ANO} Agesto</small>
        </div>
      </footer>
    </div>
  )
}

export default PaginaDeVenda
