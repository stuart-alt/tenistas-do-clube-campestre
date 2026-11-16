import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import InstalarBanner from './InstalarBanner'
import Sininho from '../notificacoes/Sininho'

const ABAS = [
  { para: '/ranking', rotulo: 'Ranking' },
  { para: '/jogadores', rotulo: 'Jogadores' },
  { para: '/salas', rotulo: 'Salas' },
  { para: '/partidas', rotulo: 'Partidas' },
  { para: '/avisos', rotulo: 'Avisos' },
]

export default function Layout() {
  const { perfil } = useAuth()
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-3 bg-green-800 px-4 py-3 text-white">
        <h1 className="flex-1 text-lg font-bold">Tenistas do Campestre</h1>
        {perfil?.is_admin && (
          <Link to="/admin" className="text-sm underline">
            Admin
          </Link>
        )}
        <Sininho />
        <Link to="/perfil" aria-label="Meu perfil">
          {perfil?.foto_url ? (
            <img src={perfil.foto_url} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-bold text-green-800">
              {perfil?.nome?.[0]?.toUpperCase() ?? '?'}
            </span>
          )}
        </Link>
      </header>
      <InstalarBanner />
      <main className="flex-1 p-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 flex border-t bg-white pb-[env(safe-area-inset-bottom)]">
        {ABAS.map((a) => (
          <NavLink
            key={a.para}
            to={a.para}
            className={({ isActive }) =>
              `flex-1 py-3 text-center text-sm ${isActive ? 'font-bold text-green-800' : 'text-gray-600'}`
            }
          >
            {a.rotulo}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
