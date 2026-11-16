import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { traduzirErro } from '../lib/erros'
import { CLASSE_INPUT } from '../auth/Campo'

export default function JogadoresAdmin() {
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const { data, isPending, error } = useQuery({
    queryKey: ['profiles', 'admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, nome, ativo, is_admin').order('nome')
      if (error) throw error
      return data ?? []
    },
  })
  const alternar = useMutation({
    mutationFn: async (j: { id: string; ativo: boolean }) => {
      const { error } = await supabase.rpc('definir_ativo', { p_jogador: j.id, p_ativo: j.ativo })
      if (error) throw error
    },
    onSuccess: () => {
      setErro('')
      void qc.invalidateQueries({ queryKey: ['profiles'] })
      void qc.invalidateQueries({ queryKey: ['ranking'] })
    },
    onError: (e) => setErro(traduzirErro(e)),
  })

  const termo = busca.trim().toLowerCase()
  const lista = (data ?? []).filter((j) => j.nome.toLowerCase().includes(termo))

  return (
    <div className="space-y-3">
      <input
        type="search"
        aria-label="Buscar jogador"
        placeholder="Buscar jogador"
        className={CLASSE_INPUT}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      {isPending && <p className="text-sm text-gray-500">Carregando...</p>}
      {(error || erro) && (
        <p role="alert" className="text-sm text-red-700">
          {erro || 'Não foi possível carregar os jogadores.'}
        </p>
      )}
      <ul className="divide-y divide-gray-200">
        {lista.map((j) => (
          <li key={j.id} className="flex items-center justify-between py-2">
            <span className={j.ativo ? '' : 'text-gray-500'}>
              {j.nome}
              {!j.ativo && ' (inativo)'}
            </span>
            <button
              disabled={alternar.isPending}
              onClick={() => alternar.mutate({ id: j.id, ativo: !j.ativo })}
              className="rounded border border-gray-400 px-3 py-1 text-sm disabled:opacity-50"
            >
              {j.ativo ? 'Desativar' : 'Ativar'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
