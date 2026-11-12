import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { ClientesPage } from './features/clientes/ClientesPage'
import { ProdutosPage } from './features/produtos/ProdutosPage'
import { ServicosPage } from './features/servicos/ServicosPage'
import { AgendaPage } from './features/agenda/AgendaPage'
import { OrcamentosPage } from './features/orcamentos/OrcamentosPage'
import { AtendimentosPage } from './features/atendimentos/AtendimentosPage'
import { ParametrizacaoPage } from './features/parametrizacao/ParametrizacaoPage'
import { RelatoriosPage } from './features/relatorios/RelatoriosPage'
import { UsuariosPage } from './features/usuarios/UsuariosPage'
import { TrocarSenha } from './pages/TrocarSenha'
import { EsqueciSenha } from './pages/EsqueciSenha'
import { AdminCriarSenha, CriarSenha, RedefinirSenha } from './pages/RedefinirSenha'
import { BaixarApp } from './pages/BaixarApp'
import { AceitarTermos } from './pages/AceitarTermos'
import { Privacidade, Termos } from './pages/legal/Documento'
import { AdminLogin } from './admin/AdminLogin'
import { AdminLayout } from './admin/AdminLayout'
import { AdminEmpresasPage } from './admin/AdminEmpresasPage'
import { AdminEmpresaPage } from './admin/AdminEmpresaPage'
import { AdminAuditoriaPage } from './admin/AuditoriaLista'
import { AdminEquipePage } from './admin/AdminEquipePage'

// DEC-57: a página de venda carrega à parte; quem usa o painel não baixa o código dela.
const PaginaDeVenda = lazy(() => import('./pages/venda/PaginaDeVenda'))

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
      {/* Públicas: links de Termos__UrlTermos e Termos__UrlPrivacidade na tela de aceite (B6). */}
      <Route path="/termos" element={<Termos />} />
      <Route path="/privacidade" element={<Privacidade />} />

      {/* Área de superadmin (equipe do Agesto): sessão e token próprios. */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminEmpresasPage />} />
        <Route path="empresas/:id" element={<AdminEmpresaPage />} />
        <Route path="auditoria" element={<AdminAuditoriaPage />} />
        <Route path="equipe" element={<AdminEquipePage />} />
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
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
