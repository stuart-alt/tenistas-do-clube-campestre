import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { formatarDiaHora, totalVagas, type SalaLista } from './tipos'

function rotuloStatus(s: SalaLista) {
  if (s.status === 'confirmada') return 'Confirmada'
  const falta = Math.max(totalVagas(s.modalidade) - (s.vagas ?? []).length, 0)
  return `Aguardando jogadores (${falta === 1 ? 'falta 1 vaga' : `faltam ${falta} vagas`})`
}

export default function SalasPage() {
  const { perfil } = useAuth()
  const [filtro, setFiltro] = useState<'todas' | 'minhas'>('todas')
  const { data, isLoading, error } = useQuery({
    queryKey: ['salas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('salas_lista').select('*').order('data_hora', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as SalaLista[]
    },
  })

  const grupos = new Map<string, SalaLista[]>()
  const visiveis = (data ?? []).filter(
    (s) => filtro === 'todas' || (s.vagas ?? []).some((v) => v.jogador_id === perfil?.id),
  )
  for (const s of visiveis) {
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
      <div className="flex gap-2">
        {(['todas', 'minhas'] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filtro === f}
            onClick={() => setFiltro(f)}
            className={`rounded px-3 py-1.5 text-sm font-semibold ${filtro === f ? 'bg-green-800 text-white' : 'border border-gray-300'}`}
          >
            {f === 'todas' ? 'Todas' : 'Minhas'}
          </button>
        ))}
      </div>
      {isLoading && <p>Carregando...</p>}
      {error && <p role="alert">Não foi possível carregar as salas.</p>}
      {!isLoading && !error && grupos.size === 0 && (
        <p className="text-gray-600">{filtro === 'minhas' ? 'Você não está em nenhuma sala.' : 'Nenhuma sala aberta.'}</p>
      )}
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
                {(s.vagas ?? []).length}/{totalVagas(s.modalidade)} · {rotuloStatus(s)}
              </p>
            </Link>
          ))}
        </section>
      ))}
    </div>
  )
}
