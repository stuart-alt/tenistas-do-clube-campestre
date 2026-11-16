import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

type Notificacao = { id: string; texto: string; link: string | null; lida: boolean; created_at: string }

export default function NotificacoesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data = [], isLoading } = useQuery({
    queryKey: ['notificacoes', 'lista'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as unknown as Notificacao[]
    },
  })
  const invalidar = () => qc.invalidateQueries({ queryKey: ['notificacoes'] })

  const marcar = useMutation({
    mutationFn: async (n: Notificacao) => {
      if (!n.lida) {
        const { error } = await supabase.from('notificacoes').update({ lida: true }).eq('id', n.id)
        if (error) throw error
      }
    },
    onSettled: (_r, _e, n) => {
      void invalidar()
      if (n.link) navigate(n.link)
    },
  })
  const marcarTodas = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('notificacoes').update({ lida: true }).eq('lida', false)
      if (error) throw error
    },
    onSuccess: () => void invalidar(),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Notificações</h2>
        <button onClick={() => marcarTodas.mutate()} className="text-sm underline">
          Marcar todas como lidas
        </button>
      </div>
      {isLoading && <p>Carregando...</p>}
      {!isLoading && data.length === 0 && <p className="text-gray-600">Nenhuma notificação.</p>}
      <ul className="space-y-2">
        {data.map((n) => (
          <li key={n.id}>
            <button
              onClick={() => marcar.mutate(n)}
              className={`block w-full rounded border p-3 text-left ${n.lida ? 'text-gray-600' : 'bg-green-50 font-bold'}`}
            >
              {n.texto}
              <span className="block text-xs font-normal text-gray-500">
                {new Date(n.created_at).toLocaleString('pt-BR')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
