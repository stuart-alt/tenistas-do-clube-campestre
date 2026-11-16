import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { CLASSE_INPUT } from '../auth/Campo'
import Avatar from '../perfil/Avatar'

type Modalidade = 'simples' | 'duplas'
const ABAS: [Modalidade, string][] = [
  ['simples', 'Simples'],
  ['duplas', 'Duplas'],
]

export default function RankingPage() {
  const { perfil } = useAuth()
  const [modalidade, setModalidade] = useState<Modalidade>('simples')
  const [categoria, setCategoria] = useState('')

  const { data, isPending, error } = useQuery({
    queryKey: ['ranking', modalidade],
    queryFn: async () => {
      const [r, regra] = await Promise.all([
        supabase.from('ranking').select('*').eq('modalidade', modalidade),
        supabase.from('regras').select('janela_meses').eq('modalidade', modalidade),
      ])
      if (r.error) throw r.error
      if (regra.error) throw regra.error
      const linhas = [...(r.data ?? [])].sort(
        (a, b) =>
          (a.posicao ?? 0) - (b.posicao ?? 0) ||
          (b.pontos ?? 0) - (a.pontos ?? 0) ||
          (a.nome ?? '').localeCompare(b.nome ?? ''),
      )
      return { linhas, janela: regra.data?.[0]?.janela_meses ?? 6 }
    },
  })

  const visiveis = (data?.linhas ?? []).filter((x) => !categoria || x.categoria === categoria)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Ranking</h1>
      <div role="tablist" className="flex gap-2">
        {ABAS.map(([m, rotulo]) => (
          <button
            key={m}
            role="tab"
            aria-selected={modalidade === m}
            onClick={() => setModalidade(m)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              modalidade === m ? 'bg-green-800 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Categoria</span>
        <select className={CLASSE_INPUT} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas</option>
          {['A', 'B', 'C', 'D'].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      {isPending && <p className="text-sm text-gray-500">Carregando...</p>}
      {error && <p role="alert" className="text-sm text-red-700">Não foi possível carregar o ranking.</p>}
      {data && visiveis.length === 0 && (
        <p className="text-sm text-gray-600">
          Nenhuma partida confirmada nos últimos {data.janela} meses.
        </p>
      )}
      <ul className="space-y-2">
        {visiveis.map((x) => (
          <li key={x.jogador_id}>
            <Link
              to={`/jogadores/${x.jogador_id}`}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                x.jogador_id === perfil?.id ? 'border-green-700 bg-green-50' : 'border-gray-200 bg-white'
              }`}
            >
              <span className="w-6 text-center font-bold">{x.posicao}</span>
              <Avatar url={x.foto_url} nome={x.nome ?? ''} tamanho="h-10 w-10" />
              <h2 className="flex-1 font-medium">{x.nome}</h2>
              <span className="text-sm text-gray-600">{x.categoria}</span>
              <span className="font-bold">{x.pontos}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
