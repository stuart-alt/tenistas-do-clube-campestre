import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import RotaProtegida from './auth/RotaProtegida'
import EntrarPage from './auth/EntrarPage'
import CadastroPage from './auth/CadastroPage'
import EsqueciSenhaPage from './auth/EsqueciSenhaPage'
import RedefinirSenhaPage from './auth/RedefinirSenhaPage'
import Layout from './layout/Layout'
import Placeholder from './layout/Placeholder'

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
              <Route path="/ranking" element={<Placeholder titulo="Ranking" />} />
              <Route path="/jogadores" element={<Placeholder titulo="Jogadores" />} />
              <Route path="/jogadores/:id" element={<Placeholder titulo="Jogador" />} />
              <Route path="/perfil" element={<Placeholder titulo="Meu perfil" />} />
              <Route path="/salas" element={<Placeholder titulo="Salas" />} />
              <Route path="/salas/nova" element={<Placeholder titulo="Nova sala" />} />
              <Route path="/salas/:id" element={<Placeholder titulo="Sala" />} />
              <Route path="/partidas" element={<Placeholder titulo="Partidas" />} />
              <Route path="/partidas/nova" element={<Placeholder titulo="Lançar partida" />} />
              <Route path="/notificacoes" element={<Placeholder titulo="Notificações" />} />
              <Route path="/avisos" element={<Placeholder titulo="Avisos" />} />
              <Route element={<SomenteAdmin />}>
                <Route path="/admin" element={<Placeholder titulo="Administração" />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
