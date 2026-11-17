import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { corNivel, formatarValidade, nomeNivel } from './conquistas'

const MODALIDADE: Record<string, string> = { simples: 'Simples', duplas: 'Duplas' }
const TOPO: Record<string, string> = { podio: 'Top 3', numero1: 'Nº 1' }

function comUnidade(valor: number, unidade: string) {
  const u = valor === 1 && unidade.endsWith('s') ? unidade.slice(0, -1) : unidade
  return `${valor} ${u}`
}

export default function Conquistas({ jogadorId, proprio }: { jogadorId: string; proprio: boolean }) {
  const { data: catalogo } = useQuery({
    queryKey: ['conquistas-catalogo'],
    queryFn: async () => {
      const { data, error } = await supabase.from('conquistas_catalogo').select('*').order('ordem')
      if (error) throw error
      return data
    },
  })
  const { data: medalhas } = useQuery({
    queryKey: ['conquistas', jogadorId],
    queryFn: async () => {
      const { data, error } = await supabase.from('conquistas_jogador').select('*').eq('jogador_id', jogadorId)
      if (error) throw error
      return data
    },
  })
  const { data: progresso } = useQuery({
    queryKey: ['progresso-conquistas', jogadorId],
    enabled: proprio,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('progresso_conquistas', { p_jogador: jogadorId })
      if (error) throw error
      return data
    },
  })
  const { data: sequencia } = useQuery({
    queryKey: ['sequencia-atual', jogadorId],
    enabled: proprio,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('sequencia_atual', { p_jogador: jogadorId })
      if (error) throw error
      return data?.[0] ?? null
    },
  })

  if (!catalogo || !medalhas) return null

  const ordem = (c: string) => catalogo.find((x) => x.chave === c)?.ordem ?? 0
  const tenho = medalhas
    .flatMap((m) => {
      const cat = catalogo.find((c) => c.chave === m.conquista)
      return cat ? [{ m, cat }] : []
    })
    .sort((a, b) => ordem(a.m.conquista) - ordem(b.m.conquista) || (a.m.modalidade ?? '').localeCompare(b.m.modalidade ?? ''))

  const metas = (progresso ?? [])
    .filter((p) => p.proximo_limite != null)
    .flatMap((p) => {
      const cat = catalogo.find((c) => c.chave === p.conquista)
      // Pódio e nº 1 são de nível único e não têm barrinha de progresso.
      return cat && !cat.por_modalidade ? [{ p, cat }] : []
    })
    .sort((a, b) => a.cat.ordem - b.cat.ordem)

  const dicaSequencia =
    proprio && !!sequencia && sequencia.semanas > 0 && !sequencia.jogou_esta_semana

  return (
    <section className="space-y-2">
      <h3 className="font-semibold text-green-800">Conquistas</h3>
      {tenho.length === 0 && <p className="text-sm text-gray-600">Ainda sem medalhas</p>}
      <ul className="space-y-2">
        {tenho.map(({ m, cat }) => {
          const unico = cat.limites.length === 1
          const titulo = unico
            ? `${TOPO[cat.chave] ?? cat.nome} ${MODALIDADE[m.modalidade ?? ''] ?? ''}`.trim()
            : cat.nome
          return (
            <li key={`${m.conquista}-${m.modalidade ?? ''}`} className="rounded border p-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span aria-hidden="true">{cat.emoji}</span>
                <span className="font-medium">{titulo}</span>
                {!unico && (
                  <span className={`rounded px-2 text-xs font-semibold ${corNivel(m.nivel)}`}>{nomeNivel(m.nivel)}</span>
                )}
                {!unico && <span className="text-sm">{comUnidade(m.valor, cat.unidade)}</span>}
                <span className="ml-auto text-sm text-gray-600">{formatarValidade(m.valida_ate)}</span>
              </div>
              <p className="text-xs text-gray-600">{cat.descricao}</p>
            </li>
          )
        })}
      </ul>
      {proprio && metas.length > 0 && (
        <ul className="space-y-2">
          {metas.map(({ p, cat }) => (
            <li key={p.conquista} className="rounded border border-dashed p-2 opacity-70">
              <div className="flex items-center gap-2">
                <span aria-hidden="true">{cat.emoji}</span>
                <span className="font-medium">{`${cat.nome} → ${nomeNivel(p.nivel + 1)}`}</span>
                <span className="ml-auto text-sm">{`${p.valor}/${p.proximo_limite}`}</span>
              </div>
              <div
                role="progressbar"
                aria-label={`Progresso de ${cat.nome}`}
                aria-valuemin={0}
                aria-valuenow={p.valor}
                aria-valuemax={p.proximo_limite}
                className="mt-1 h-2 overflow-hidden rounded bg-gray-200"
              >
                <div
                  className="h-full bg-green-700"
                  style={{ width: `${Math.min(100, (p.valor / p.proximo_limite) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-600">{cat.descricao}</p>
              {p.conquista === 'sequencia' && dicaSequencia && (
                <p className="text-sm text-gray-700">Jogue esta semana para não quebrar a sequência</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
