import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import RotaProtegida from './auth/RotaProtegida'
import EntrarPage from './auth/EntrarPage'
import CadastroPage from './auth/CadastroPage'
import EsqueciSenhaPage from './auth/EsqueciSenhaPage'
import RedefinirSenhaPage from './auth/RedefinirSenhaPage'
import Layout from './layout/Layout'
import AdminPage from './admin/AdminPage'
import BuscarPage from './jogadores/BuscarPage'
import PerfilPage from './perfil/PerfilPage'
import EditarPerfilPage from './perfil/EditarPerfilPage'
import RankingPage from './ranking/RankingPage'
import PartidasPage from './partidas/PartidasPage'
import LancarPartidaPage from './partidas/LancarPartidaPage'
import SalasPage from './salas/SalasPage'
import NovaSalaPage from './salas/NovaSalaPage'
import SalaPage from './salas/SalaPage'
import NotificacoesPage from './notificacoes/NotificacoesPage'
import AvisosPage from './avisos/AvisosPage'

function SomenteAdmin() {
  const { perfil, carregando } = useAuth()
  if (carregando) return null
  return perfil?.is_admin ? <Outlet /> : <Navigate to="/ranking" replace />
}

export default function App() {
  return (
    <BrowserRouter
      basename={import.meta.env.BASE_URL.replace(/\/$/, '')}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AuthProvider>
        <Routes>
          <Route path="/entrar" element={<EntrarPage />} />
          <Route path="/cadastro" element={<CadastroPage />} />
          <Route path="/esqueci-senha" element={<EsqueciSenhaPage />} />
          <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />
          <Route element={<RotaProtegida />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/ranking" replace />} />
              <Route path="/ranking" element={<RankingPage />} />
              <Route path="/jogadores" element={<BuscarPage />} />
              <Route path="/jogadores/:id" element={<PerfilPage />} />
              <Route path="/perfil" element={<EditarPerfilPage />} />
              <Route path="/salas" element={<SalasPage />} />
              <Route path="/salas/nova" element={<NovaSalaPage />} />
              <Route path="/salas/:id" element={<SalaPage />} />
              <Route path="/partidas" element={<PartidasPage />} />
              <Route path="/partidas/nova" element={<LancarPartidaPage />} />
              <Route path="/notificacoes" element={<NotificacoesPage />} />
              <Route path="/avisos" element={<AvisosPage />} />
              <Route element={<SomenteAdmin />}>
                <Route path="/admin" element={<AdminPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
