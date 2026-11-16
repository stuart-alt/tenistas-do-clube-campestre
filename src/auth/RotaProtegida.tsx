import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export default function RotaProtegida() {
  const { session, carregando } = useAuth()
  if (carregando) return <p className="p-6 text-center text-gray-500">Carregando...</p>
  if (!session) return <Navigate to="/entrar" replace />
  return <Outlet />
}
