import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * Manual de uso curto (KAN-42): página pública para o Dono (painel web) e o
 * agente (app). O painel abre pelo menu "Ajuda" e pela aba Suporte; o app, pela
 * aba "Mais" (link de App__UrlManual na API). Imprime como PDF para o treino.
 * Ao mudar uma tela, atualize o trecho dela aqui e a data abaixo.
 */
export const ATUALIZADO_EM = '23 de novembro de 2026'

export interface Secao {
  id: string
  titulo: string
  conteudo: ReactNode
}

export const DONO: Secao[] = [
  {
    id: 'primeiro-acesso',
    titulo: 'Primeiro acesso',
    conteudo: (
      <>
        <ol className="passos">
          <li>
            Abra o email de convite do Agesto e clique no link. Ele vale 72 horas e só funciona uma vez; se venceu,
            peça um novo à equipe do Agesto.
          </li>
          <li>
            Em <b>Crie a sua senha</b>, escolha a senha e clique em <b>Salvar senha nova</b>.
          </li>
          <li>
            Entre com o email e a senha. No primeiro acesso, leia os termos e clique em <b>Li e aceito</b>.
          </li>
        </ol>
        <p className="passos-nota">
          Esqueceu a senha? Na tela de entrada, clique em <b>Esqueci a senha</b> e depois em <b>Enviar link</b>. O link
          chega por email e vale 15 minutos. Para trocar a senha com o painel aberto, clique no seu nome, no fim da
          barra lateral, e em <b>Alterar senha</b>.
        </p>
      </>
    ),
  },
  {
    id: 'parametrizacao',
    titulo: 'Configure a empresa',
    conteudo: (
      <>
        <p className="passos-nota">
          Em <b>Parametrização</b>, escolha como a empresa trabalha e clique em <b>Salvar</b>:
        </p>
        <ul className="manual-lista">
          <li>
            <b>Tipo de operação</b>: Serviço, Venda ou Híbrido. Em Venda, o menu esconde Serviços e Agenda.
          </li>
          <li>
            <b>Modo da agenda</b>: em Flexível, o agente também agenda pelo app; em Fixa, só você agenda.
          </li>
          <li>
            <b>Controlar estoque</b>: baixa o estoque dos produtos usados nos atendimentos.
          </li>
          <li>
            <b>Técnico cadastra serviço</b>: deixa o agente criar um serviço novo pelo app. Ele aparece em Serviços
            como <b>A revisar</b> até você clicar em <b>Revisado</b>.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'cadastros',
    titulo: 'Clientes, serviços e produtos',
    conteudo: (
      <>
        <ul className="manual-lista">
          <li>
            <b>Clientes</b> → <b>Novo cliente</b>. Nome e CPF são obrigatórios. Com o telefone preenchido, o botão{' '}
            <b>WhatsApp</b> abre a conversa com o cliente.
          </li>
          <li>
            <b>Serviços</b> → <b>Novo serviço</b>. Escolha a cobrança <b>Por hora</b> ou <b>Empreitada</b> e, se quiser,
            a duração estimada, que ajuda a montar a agenda e os relatórios.
          </li>
          <li>
            <b>Produtos</b> → <b>Novo produto</b>, com nome, preço e estoque. O filtro <b>Atenção</b> mostra o que está
            acabando.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'equipe',
    titulo: 'Sua equipe',
    conteudo: (
      <>
        <p className="passos-nota">
          Em <b>Usuários</b> → <b>Novo usuário</b>, escolha o perfil:
        </p>
        <ul className="manual-lista">
          <li>
            <b>Agente (usa o app em campo)</b>: você cria o login (no formato nome@empresa, não precisa ser um email de
            verdade) e a senha, com pelo menos 8 caracteres. Passe os dois para o agente; ele já pode entrar no app. Se
            ele esquecer a senha, use <b>Definir senha</b>.
          </li>
          <li>
            <b>Dono (acessa este painel)</b>: a pessoa recebe um convite por email e cria a própria senha. Se ela não
            achou o email ou o convite venceu, use <b>Reenviar convite</b>.
          </li>
        </ul>
        <p className="passos-nota">
          Quem sai da equipe pode ser desligado com <b>Desativar</b>. A quantidade de acessos depende da sua assinatura;
          para aumentar, fale com a equipe do Agesto.
        </p>
      </>
    ),
  },
  {
    id: 'orcamentos',
    titulo: 'Orçamentos',
    conteudo: (
      <ol className="passos">
        <li>
          Em <b>Orçamentos</b> → <b>Novo orçamento</b>, escolha o cliente e use <b>Adicionar item</b> para incluir
          serviços, produtos ou um item avulso. Clique em <b>Criar orçamento</b>.
        </li>
        <li>
          No orçamento, use <b>Enviar PDF por WhatsApp</b> ou <b>Baixar PDF</b>. O PDF não mostra custo nem margem. Depois
          clique em <b>Marcar como enviado</b>.
        </li>
        <li>
          Quando o cliente responder, clique em <b>Marcar como aprovado</b> ou <b>Recusado</b>.
        </li>
        <li>
          Aprovado, clique em <b>Converter em atendimento</b>. É nesse momento que o estoque baixa.
        </li>
      </ol>
    ),
  },
  {
    id: 'atendimentos',
    titulo: 'Agenda e atendimentos',
    conteudo: (
      <>
        <ol className="passos">
          <li>
            Em <b>Atendimentos</b> (ou na <b>Agenda</b>) → <b>Novo atendimento</b>, escolha o cliente, o responsável (você
            ou um agente) e, se quiser, a data em <b>Agendar para</b>. Clique em <b>Criar atendimento</b>.
          </li>
          <li>
            O atendimento aparece no app do agente responsável na próxima sincronização. O que o agente registra em campo
            aparece aqui do mesmo jeito.
          </li>
          <li>
            No atendimento, use <b>Adicionar item</b> para lançar serviços e produtos e <b>Salvar alterações</b>.
          </li>
        </ol>
        <p className="passos-nota">
          A <b>Agenda</b> mostra o mês em <b>Calendário</b> ou no <b>Mapa</b>, com filtro por responsável. O sino na barra
          do topo avisa os atendimentos pendentes de hoje e os atrasados. Cancelar um atendimento devolve ao estoque os
          produtos que ele tinha baixado.
        </p>
      </>
    ),
  },
  {
    id: 'recebimentos',
    titulo: 'Recebimentos',
    conteudo: (
      <p className="passos-nota">
        A aba <b>A receber</b>, em Atendimentos, lista os concluídos que ainda não foram pagos, com o total. Abra o
        atendimento, preencha <b>Pago em</b> e <b>Forma</b> e clique em <b>Registrar recebimento</b>. Registrou por
        engano? Use <b>Voltar para a receber</b>.
      </p>
    ),
  },
  {
    id: 'numeros',
    titulo: 'Seus números',
    conteudo: (
      <>
        <p className="passos-nota">
          A <b>Visão geral</b> mostra faturamento, margem, ticket médio, receita por dia e os serviços que mais faturam.
          Os <b>Relatórios</b> detalham quanto sobrou, de onde vem o faturamento, a receita por serviço e o estoque. Troque
          o período no topo da tela: <b>7 dias</b>, <b>Mês</b> ou <b>Ano</b>.
        </p>
        <p className="passos-nota">
          O botão de mensagem no topo abre o assistente do Agesto, que responde perguntas sobre os seus números, como
          &ldquo;Quanto sobrou este mês?&rdquo;. Ele não tem relação com os agentes de campo da sua equipe.
        </p>
      </>
    ),
  },
  {
    id: 'assinatura',
    titulo: 'Assinatura',
    conteudo: (
      <p className="passos-nota">
        Em <b>Parametrização</b>, o bloco <b>Assinatura</b> mostra o valor, os acessos e o vencimento. Perto do vencimento
        aparece um aviso no topo do painel. Depois de 10 dias de atraso, o acesso é bloqueado até o pagamento ser
        registrado pela equipe do Agesto.
      </p>
    ),
  },
  {
    id: 'suporte',
    titulo: 'Suporte',
    conteudo: (
      <p className="passos-nota">
        Em <b>Suporte</b> → <b>Novo chamado</b>, escolha o assunto, escreva a mensagem e, se ajudar, use{' '}
        <b>Anexar arquivo</b> para mandar até 3 prints ou PDFs de 5 MB cada. Clique em <b>Enviar chamado</b>. Você recebe
        uma cópia por email, e a resposta da equipe aparece no chamado e no seu email.
      </p>
    ),
  },
]

export const AGENTE: Secao[] = [
  {
    id: 'instalar',
    titulo: 'Instalar e entrar',
    conteudo: (
      <>
        <ol className="passos">
          <li>
            No celular Android, abra a página <Link to="/baixar">Baixar o app</Link> e siga os passos para instalar.
          </li>
          <li>
            Abra o Agesto e entre com o login e a senha que o responsável pela empresa passou para você.
          </li>
        </ol>
        <p className="passos-nota">
          Esqueceu a senha? Peça uma nova ao responsável pela empresa: ele troca no painel, na hora.
        </p>
      </>
    ),
  },
  {
    id: 'dia',
    titulo: 'Seu dia',
    conteudo: (
      <p className="passos-nota">
        O <b>Início</b> mostra o próximo atendimento e os que ainda faltam hoje. Em cada visita há <b>Iniciar agora</b>,{' '}
        <b>Ir até</b> (abre o mapa) e o WhatsApp do cliente. <b>Iniciar rota</b> abre no Google Maps o caminho por todas
        as paradas do dia. A aba <b>Agenda</b> mostra hoje e amanhã. Nos dias com atendimento pendente, o app avisa às 7h.
      </p>
    ),
  },
  {
    id: 'registrar',
    titulo: 'Registrar ou concluir um atendimento',
    conteudo: (
      <>
        <ol className="passos">
          <li>
            Toque numa visita da agenda para concluí-la, ou em <b>Registrar atendimento</b> no Início para um atendimento
            novo.
          </li>
          <li>
            Escolha o cliente e marque os serviços e produtos com a quantidade. Para algo fora da lista, use{' '}
            <b>Item avulso</b>. Se precisar, ajuste o preço.
          </li>
          <li>
            Escolha <b>Concluído</b> ou <b>Pendente</b> e toque no botão de salvar no fim da tela.
          </li>
        </ol>
        <p className="passos-nota">
          Cliente desistiu? Use <b>Cancelar atendimento</b>. Para cadastrar um cliente novo, vá em <b>Clientes</b> →{' '}
          <b>Novo</b>: nome e CPF são obrigatórios.
        </p>
      </>
    ),
  },
  {
    id: 'offline',
    titulo: 'Sem internet e sincronização',
    conteudo: (
      <>
        <p className="passos-nota">
          O app funciona sem internet: tudo fica guardado no celular e é enviado sozinho quando a internet volta, ao
          abrir o app ou ao voltar para ele. O que ainda não foi enviado aparece como <b>não enviado</b> em{' '}
          <b>Atend.</b>, e dá para corrigir tocando no registro.
        </p>
        <p className="passos-nota">
          Em <b>Mais</b> você vê o que está pendente e a última sincronização, e pode tocar em <b>Sincronizar agora</b>.
        </p>
        <p className="passos-nota manual-alerta">
          Antes de sair do app ou entrar com outra conta, sincronize. Sair com registros pendentes apaga esses
          registros do celular, e o app sempre avisa antes.
        </p>
      </>
    ),
  },
  {
    id: 'versao-nova',
    titulo: 'Versão nova do app',
    conteudo: (
      <p className="passos-nota">
        Quando o Início mostrar <b>Versão nova do app</b>, sincronize primeiro, toque no aviso e instale o APK novo por
        cima do antigo. Os dados do celular continuam lá.
      </p>
    ),
  },
]
