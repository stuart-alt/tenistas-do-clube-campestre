import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import RegrasForm from './RegrasForm'
import Contestacoes from './Contestacoes'
import JogadoresAdmin from './JogadoresAdmin'
import MensagensAdmin from './MensagensAdmin'

const ABAS = ['Regras', 'Partidas', 'Jogadores', 'Mensagens'] as const

function Regras() {
  const { data, isPending, error } = useQuery({
    queryKey: ['regras'],
    queryFn: async () => {
      const { data, error } = await supabase.from('regras').select('*').order('modalidade')
      if (error) throw error
      return data ?? []
    },
  })
  return (
    <div className="space-y-4">
      {isPending && <p className="text-sm text-gray-500">Carregando...</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          Não foi possível carregar as regras.
        </p>
      )}
      {data?.map((r) => <RegrasForm key={`${r.modalidade}-${JSON.stringify(r)}`} regra={r} />)}
    </div>
  )
}

export default function AdminPage() {
  const [aba, setAba] = useState<(typeof ABAS)[number]>('Regras')
  return (
    <div className="space-y-4 pb-20">
      <h1 className="text-xl font-bold">Administração</h1>
      <div role="tablist" className="flex gap-2">
        {ABAS.map((a) => (
          <button
            key={a}
            role="tab"
            aria-selected={aba === a}
            onClick={() => setAba(a)}
            className={`rounded px-3 py-1.5 text-sm font-semibold ${aba === a ? 'bg-green-800 text-white' : 'border border-gray-300'}`}
          >
            {a}
          </button>
        ))}
      </div>
      {aba === 'Regras' && <Regras />}
      {aba === 'Partidas' && <Contestacoes />}
      {aba === 'Jogadores' && <JogadoresAdmin />}
      {aba === 'Mensagens' && <MensagensAdmin />}
    </div>
  )
}
