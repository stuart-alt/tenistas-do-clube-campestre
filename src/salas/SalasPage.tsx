import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { formatarDiaHora, totalVagas, type SalaLista } from './tipos'

export default function SalasPage() {
  const { perfil } = useAuth()
  const { data, isLoading, error } = useQuery({
    queryKey: ['salas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('salas_lista').select('*').order('data_hora', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as SalaLista[]
    },
  })

  const grupos = new Map<string, SalaLista[]>()
  for (const s of data ?? []) {
    const { dia } = formatarDiaHora(s.data_hora)
    grupos.set(dia, [...(grupos.get(dia) ?? []), s])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Salas</h2>
        {!perfil?.is_admin && (
          <Link to="/salas/nova" className="rounded bg-green-800 px-3 py-2 text-sm font-bold text-white">
            Criar sala
          </Link>
        )}
      </div>
      {isLoading && <p>Carregando...</p>}
      {error && <p role="alert">Não foi possível carregar as salas.</p>}
      {!isLoading && !error && grupos.size === 0 && <p className="text-gray-600">Nenhuma sala aberta.</p>}
      {[...grupos].map(([dia, salas]) => (
        <section key={dia} className="space-y-2">
          <h3 className="font-bold capitalize">{dia}</h3>
          {salas.map((s) => (
            <Link key={s.id} to={`/salas/${s.id}`} className="block rounded border p-3">
              <div className="flex justify-between">
                <span className="font-bold">{s.modalidade === 'duplas' ? 'Duplas' : 'Simples'}</span>
                <span>{formatarDiaHora(s.data_hora).hora}</span>
              </div>
              {s.recado && <p className="text-sm text-gray-700">{s.recado}</p>}
              <p className="text-sm text-gray-600">
                {(s.vagas ?? []).length}/{totalVagas(s.modalidade)} · {s.status === 'confirmada' ? 'Confirmada' : 'Aberta'}
              </p>
            </Link>
          ))}
        </section>
      ))}
    </div>
  )
}
