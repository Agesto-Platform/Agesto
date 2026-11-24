import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { TrocarSenha } from './pages/TrocarSenha'
import { EsqueciSenha } from './pages/EsqueciSenha'
import { AdminCriarSenha, CriarSenha, RedefinirSenha } from './pages/RedefinirSenha'
import { BaixarApp } from './pages/BaixarApp'
import { AceitarTermos } from './pages/AceitarTermos'
import { Privacidade, Termos } from './pages/legal/Documento'
import { Manual } from './pages/manual/Manual'
import { AdminLogin } from './admin/AdminLogin'
import { AdminLayout } from './admin/AdminLayout'

// DEC-57: a página de venda carrega à parte; quem usa o painel não baixa o código dela.
const PaginaDeVenda = lazy(() => import('./pages/venda/PaginaDeVenda'))

// KAN-30: as telas do painel e do superadmin também carregam sob demanda. O login e o
// Dashboard (primeira tela do Dono) seguem no pacote inicial; o AppShell e o
// AdminLayout seguram a troca de tela com Suspense em volta do Outlet.
const AtendimentosPage = lazy(() => import('./features/atendimentos/AtendimentosPage').then((m) => ({ default: m.AtendimentosPage })))
const OrcamentosPage = lazy(() => import('./features/orcamentos/OrcamentosPage').then((m) => ({ default: m.OrcamentosPage })))
const AgendaPage = lazy(() => import('./features/agenda/AgendaPage').then((m) => ({ default: m.AgendaPage })))
const ClientesPage = lazy(() => import('./features/clientes/ClientesPage').then((m) => ({ default: m.ClientesPage })))
const ProdutosPage = lazy(() => import('./features/produtos/ProdutosPage').then((m) => ({ default: m.ProdutosPage })))
const ServicosPage = lazy(() => import('./features/servicos/ServicosPage').then((m) => ({ default: m.ServicosPage })))
const UsuariosPage = lazy(() => import('./features/usuarios/UsuariosPage').then((m) => ({ default: m.UsuariosPage })))
const RelatoriosPage = lazy(() => import('./features/relatorios/RelatoriosPage').then((m) => ({ default: m.RelatoriosPage })))
const ParametrizacaoPage = lazy(() =>
  import('./features/parametrizacao/ParametrizacaoPage').then((m) => ({ default: m.ParametrizacaoPage })),
)
const SuportePage = lazy(() => import('./features/suporte/SuportePage').then((m) => ({ default: m.SuportePage })))
const AdminEmpresasPage = lazy(() => import('./admin/AdminEmpresasPage').then((m) => ({ default: m.AdminEmpresasPage })))
const AdminEmpresaPage = lazy(() => import('./admin/AdminEmpresaPage').then((m) => ({ default: m.AdminEmpresaPage })))
const AdminAuditoriaPage = lazy(() => import('./admin/AuditoriaLista').then((m) => ({ default: m.AdminAuditoriaPage })))
const AdminEquipePage = lazy(() => import('./admin/AdminEquipePage').then((m) => ({ default: m.AdminEquipePage })))
const AdminSuportePage = lazy(() => import('./admin/AdminSuportePage').then((m) => ({ default: m.AdminSuportePage })))

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Públicas: "Esqueci a senha" do Dono e o link do email (DEC-54). */}
      <Route path="/esqueci-senha" element={<EsqueciSenha />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      {/* Públicas: primeira senha pelo convite por email (DEC-55). */}
      <Route path="/criar-senha" element={<CriarSenha />} />
      <Route path="/admin/criar-senha" element={<AdminCriarSenha />} />
      {/* Pública: o agente abre no celular para instalar o APK (DEC-47). */}
      <Route path="/baixar" element={<BaixarApp />} />
      {/* DEC-57: link para divulgar; mostra a página de venda mesmo para quem está logado. */}
      <Route
        path="/conheca"
        element={
          <Suspense fallback={null}>
            <PaginaDeVenda />
          </Suspense>
        }
      />
      {/* Públicas: links de Termos__UrlTermos e Termos__UrlPrivacidade na tela de aceite (B6). */}
      <Route path="/termos" element={<Termos />} />
      <Route path="/privacidade" element={<Privacidade />} />
      {/* Pública: manual de uso do Dono e do agente (KAN-42); o app abre por App__UrlManual. */}
      <Route path="/manual" element={<Manual />} />

      {/* Área de superadmin (equipe do Agesto): sessão e token próprios. */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminEmpresasPage />} />
        <Route path="empresas/:id" element={<AdminEmpresaPage />} />
        <Route path="auditoria" element={<AdminAuditoriaPage />} />
        <Route path="equipe" element={<AdminEquipePage />} />
        <Route path="suporte" element={<AdminSuportePage />} />
      </Route>

      <Route
        element={
          <ProtectedRoute
            raizPublica={
              <Suspense fallback={null}>
                <PaginaDeVenda />
              </Suspense>
            }
          />
        }
      >
        <Route path="/aceitar-termos" element={<AceitarTermos />} />
        <Route path="/trocar-senha" element={<TrocarSenha />} />
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="atendimentos" element={<AtendimentosPage />} />
          <Route path="orcamentos" element={<OrcamentosPage />} />
          <Route path="agenda" element={<AgendaPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="produtos" element={<ProdutosPage />} />
          <Route path="servicos" element={<ServicosPage />} />
          <Route path="usuarios" element={<UsuariosPage />} />
          <Route path="relatorios" element={<RelatoriosPage />} />
          <Route path="parametrizacao" element={<ParametrizacaoPage />} />
          <Route path="suporte" element={<SuportePage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
