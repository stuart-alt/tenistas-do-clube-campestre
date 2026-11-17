import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Aviso para partidas fora das N melhores da semana (pontos_partida.conta = false)
export default function NaoContou({ modalidade }: { modalidade: string }) {
  const { data } = useQuery({
    queryKey: ['regras', 'limite-semanal'],
    queryFn: async () => {
      const { data, error } = await supabase.from('regras').select('modalidade, max_partidas_semana')
      if (error) throw error
      return data as { modalidade: string; max_partidas_semana: number }[]
    },
  })
  const n = data?.find((r) => r.modalidade === modalidade)?.max_partidas_semana

  return (
    <span className="block text-xs text-gray-500">
      {n ? `Não contou para o ranking (fora das ${n} melhores da semana)` : 'Não contou para o ranking'}
    </span>
  )
}
