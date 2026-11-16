import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { traduzirErro } from '../lib/erros'
import { hojeLocal } from '../lib/datas'
import { CLASSE_INPUT } from '../auth/Campo'
import PartidaCard, { type PartidaDetalhe } from '../partidas/PartidaCard'
import PlacarInput, { type SetPlacar } from '../partidas/PlacarInput'

const SELECT =
  '*, partida_jogadores(jogador_id, lado, profiles(nome, foto_url)), partida_sets(ordem, games_lado1, games_lado2, super_tiebreak), pontos_partida(jogador_id, vitoria, pontos, bonus)'

function Acoes({ partida }: { partida: PartidaDetalhe }) {
  const qc = useQueryClient()
  const [corrigindo, setCorrigindo] = useState(false)
  const [data, setData] = useState(partida.data_jogo.slice(0, 10))
  const [sets, setSets] = useState<SetPlacar[]>(
    [...partida.partida_sets]
      .sort((a, b) => a.ordem - b.ordem)
      .map((s) => ({ l1: s.games_lado1, l2: s.games_lado2, stb: s.super_tiebreak })),
  )
  const [erro, setErro] = useState('')
  const opcoes = {
    onSuccess: () => {
      setErro('')
      setCorrigindo(false)
      void qc.invalidateQueries({ queryKey: ['partidas'] })
      void qc.invalidateQueries({ queryKey: ['ranking'] })
    },
    onError: (e: unknown) => setErro(traduzirErro(e)),
  }
  const confirmar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('confirmar_partida', { p_id: partida.id })
      if (error) throw error
    },
    ...opcoes,
  })
  const corrigir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_corrigir_partida', {
        p_id: partida.id,
        p_data_jogo: data,
        p_sets: sets,
      })
      if (error) throw error
    },
    ...opcoes,
  })
  const cancelar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_cancelar_partida', { p_id: partida.id })
      if (error) throw error
    },
    ...opcoes,
  })
  const ocupado = confirmar.isPending || corrigir.isPending || cancelar.isPending
  const aberta = partida.status === 'pendente' || partida.status === 'contestada'
  if (partida.status === 'cancelada') return null

  return (
    <div className="space-y-2 pt-2">
      {erro && (
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      )}
      {corrigindo ? (
        <div className="space-y-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Data do jogo</span>
            <input
              type="date"
              max={hojeLocal()}
              className={CLASSE_INPUT}
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </label>
          <PlacarInput valor={sets} onChange={setSets} />
          <div className="flex gap-2">
            <button
              disabled={ocupado || !data}
              onClick={() => corrigir.mutate()}
              className="rounded bg-green-800 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Salvar correção
            </button>
            <button onClick={() => setCorrigindo(false)} className="px-3 py-1.5 text-sm">
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {aberta && (
            <button
              disabled={ocupado}
              onClick={() => confirmar.mutate()}
              className="rounded bg-green-800 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Confirmar
            </button>
          )}
          <button
            disabled={ocupado}
            onClick={() => setCorrigindo(true)}
            className="rounded border border-green-800 px-3 py-1.5 text-sm font-semibold text-green-800 disabled:opacity-50"
          >
            Corrigir
          </button>
          <button
            disabled={ocupado}
            onClick={() => {
              if (window.confirm('Cancelar esta partida?')) cancelar.mutate()
            }}
            className="rounded border border-red-700 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

export default function Contestacoes() {
  const [busca, setBusca] = useState('')
  const { data, isPending, error } = useQuery({
    queryKey: ['partidas', 'admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partidas')
        .select(SELECT)
        .order('data_jogo', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as unknown as PartidaDetalhe[]
    },
  })

  const termo = busca.trim().toLowerCase()
  const contestadas = (data ?? []).filter((p) => p.status === 'contestada')
  const achadas = termo
    ? (data ?? []).filter((p) => p.partida_jogadores.some((j) => j.profiles?.nome.toLowerCase().includes(termo)))
    : []

  return (
    <div className="space-y-6">
      {isPending && <p className="text-sm text-gray-500">Carregando...</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          Não foi possível carregar as partidas.
        </p>
      )}
      {data && (
        <>
          <section className="space-y-2">
            <h2 className="font-semibold">Contestadas</h2>
            {contestadas.length === 0 && <p className="text-sm text-gray-600">Nenhuma contestação.</p>}
            {contestadas.map((p) => (
              <PartidaCard key={p.id} partida={p}>
                <Acoes partida={p} />
              </PartidaCard>
            ))}
          </section>
          <section className="space-y-2">
            <h2 className="font-semibold">Buscar partida</h2>
            <input
              type="search"
              aria-label="Buscar partida por jogador"
              placeholder="Nome do jogador"
              className={CLASSE_INPUT}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            {termo && achadas.length === 0 && <p className="text-sm text-gray-600">Nenhuma partida encontrada.</p>}
            {achadas.map((p) => (
              <PartidaCard key={p.id} partida={p}>
                <Acoes partida={p} />
              </PartidaCard>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
