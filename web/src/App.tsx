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
import { BaixarApp } from './pages/BaixarApp'
import { Privacidade, Termos } from './pages/legal/Documento'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Pública: o agente abre no celular para instalar o APK (DEC-47). */}
      <Route path="/baixar" element={<BaixarApp />} />
      {/* Públicas: links de Termos__UrlTermos e Termos__UrlPrivacidade na tela de aceite (B6). */}
      <Route path="/termos" element={<Termos />} />
      <Route path="/privacidade" element={<Privacidade />} />

      <Route element={<ProtectedRoute />}>
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
