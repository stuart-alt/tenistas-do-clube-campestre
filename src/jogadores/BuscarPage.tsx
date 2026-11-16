import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { CLASSE_INPUT } from '../auth/Campo'
import { DIAS, PERIODOS, ROTULO_DIA, ROTULO_PERIODO, emComum } from '../lib/disponibilidade'
import Avatar from '../perfil/Avatar'

function Filtro({
  rotulo,
  valor,
  onChange,
  opcoes,
}: {
  rotulo: string
  valor: string
  onChange: (v: string) => void
  opcoes: [string, string][]
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block font-medium">{rotulo}</span>
      <select className={CLASSE_INPUT} value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">Todos</option>
        {opcoes.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function BuscarPage() {
  const { perfil } = useAuth()
  const [dia, setDia] = useState('')
  const [periodo, setPeriodo] = useState('')
  const [categoria, setCategoria] = useState('')
  const [genero, setGenero] = useState('')

  const { data, isPending, error } = useQuery({
    queryKey: ['jogadores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, categoria, genero, foto_url, disponibilidade, is_admin')
        .eq('ativo', true)
      if (error) throw error
      return data
    },
  })

  const meus = perfil?.disponibilidade ?? []
  const lista = (data ?? [])
    .filter((j) => j.id !== perfil?.id && !j.is_admin)
    .filter((j) => !categoria || j.categoria === categoria)
    .filter((j) => !genero || j.genero === genero)
    .filter(
      (j) =>
        (!dia && !periodo) ||
        j.disponibilidade.some((s) => {
          const [d, p] = s.split('_')
          return (!dia || d === dia) && (!periodo || p === periodo)
        }),
    )
    .map((j) => ({ ...j, comum: emComum(meus, j.disponibilidade) }))
    .sort((a, b) => b.comum - a.comum || a.nome.localeCompare(b.nome, 'pt-BR'))

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h2 className="text-xl font-bold text-green-800">Jogadores</h2>
      <div className="grid grid-cols-2 gap-3">
        <Filtro rotulo="Dia" valor={dia} onChange={setDia} opcoes={DIAS.map((d) => [d, ROTULO_DIA[d]])} />
        <Filtro
          rotulo="Período"
          valor={periodo}
          onChange={setPeriodo}
          opcoes={PERIODOS.map((p) => [p, ROTULO_PERIODO[p]])}
        />
        <Filtro
          rotulo="Categoria"
          valor={categoria}
          onChange={setCategoria}
          opcoes={['A', 'B', 'C', 'D'].map((c) => [c, c])}
        />
        <Filtro
          rotulo="Gênero"
          valor={genero}
          onChange={setGenero}
          opcoes={[
            ['masculino', 'Masculino'],
            ['feminino', 'Feminino'],
          ]}
        />
      </div>
      {isPending && <p>Carregando...</p>}
      {error && <p role="alert">Não foi possível carregar os jogadores.</p>}
      <ul className="space-y-2">
        {lista.map((j) => (
          <li key={j.id}>
            <Link to={`/jogadores/${j.id}`} className="flex items-center gap-3 rounded border p-3">
              <Avatar url={j.foto_url} nome={j.nome} tamanho="h-12 w-12" />
              <div>
                <h3 className="font-semibold">{j.nome}</h3>
                <p className="text-sm text-gray-600">
                  Categoria {j.categoria} · {j.comum} {j.comum === 1 ? 'horário' : 'horários'} em comum
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
