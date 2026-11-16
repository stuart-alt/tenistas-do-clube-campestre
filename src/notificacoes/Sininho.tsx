import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export default function Sininho() {
  const navigate = useNavigate()
  const { data: naoLidas = 0 } = useQuery({
    queryKey: ['notificacoes', 'contagem'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notificacoes')
        .select('id', { count: 'exact', head: true })
        .eq('lida', false)
      if (error) throw error
      return count ?? 0
    },
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  })

  return (
    <button
      onClick={() => navigate('/notificacoes')}
      aria-label="Notificações"
      className="relative h-8 w-8 text-xl leading-8"
    >
      <span aria-hidden="true">🔔</span>
      {naoLidas > 0 && (
        <span className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full bg-red-600 px-1 text-xs font-bold leading-5 text-white">
          {naoLidas}
        </span>
      )}
    </button>
  )
}
