import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { CLASSE_INPUT } from '../auth/Campo'
import { traduzirErro } from '../lib/erros'
import PartidaCard, { type PartidaDetalhe } from './PartidaCard'

const SELECT =
  '*, partida_jogadores(jogador_id, lado, profiles(nome, foto_url)), partida_sets(ordem, games_lado1, games_lado2, super_tiebreak), pontos_partida(jogador_id, vitoria, pontos, bonus, conta)'

const ladoDe = (p: PartidaDetalhe, id: string) => p.partida_jogadores.find((j) => j.jogador_id === id)?.lado

function horasRestantes(criada: string) {
  const ms = new Date(criada).getTime() + 48 * 3600_000 - Date.now()
  return Math.max(0, Math.ceil(ms / 3600_000))
}

function Acoes({ partida }: { partida: PartidaDetalhe }) {
  const qc = useQueryClient()
  const [contestando, setContestando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const aoSucesso = () => {
    void qc.invalidateQueries({ queryKey: ['partidas'] })
    void qc.invalidateQueries({ queryKey: ['ranking'] })
  }
  const confirmar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('confirmar_partida', { p_id: partida.id })
      if (error) throw error
    },
    onSuccess: aoSucesso,
    onError: (e) => setErro(traduzirErro(e)),
  })
  const contestar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('contestar_partida', { p_id: partida.id, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: aoSucesso,
    onError: (e) => setErro(traduzirErro(e)),
  })
  const ocupado = confirmar.isPending || contestar.isPending

  return (
    <div className="space-y-2 pt-2">
      {erro && (
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      )}
      {contestando ? (
        <div className="space-y-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Motivo da contestação</span>
            <textarea className={CLASSE_INPUT} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button
              disabled={ocupado || !motivo.trim()}
              onClick={() => contestar.mutate()}
              className="rounded bg-red-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Enviar contestação
            </button>
            <button onClick={() => setContestando(false)} className="px-3 py-1.5 text-sm">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            disabled={ocupado}
            onClick={() => confirmar.mutate()}
            className="rounded bg-green-800 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Confirmar
          </button>
          <button
            disabled={ocupado}
            onClick={() => setContestando(true)}
            className="rounded border border-red-700 px-3 py-1.5 text-sm font-semibold text-red-700 disabled:opacity-50"
          >
            Contestar
          </button>
        </div>
      )}
    </div>
  )
}

export default function PartidasPage() {
  const { perfil } = useAuth()
  const eu = perfil?.id ?? ''
  const { data, isPending, error } = useQuery({
    queryKey: ['partidas', 'lista', eu],
    enabled: !!eu,
    queryFn: async () => {
      // "eu" restringe às partidas em que o usuário joga; partida_jogadores segue trazendo todos
      const { data, error } = await supabase
        .from('partidas')
        .select(SELECT + ', eu:partida_jogadores!inner(jogador_id)')
        .eq('eu.jogador_id', eu)
        .order('data_jogo', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as PartidaDetalhe[]
    },
  })

  const minhas = (data ?? []).filter((p) => ladoDe(p, eu) !== undefined)
  const pendentes = minhas.filter((p) => p.status === 'pendente')
  const aguardandoMim = pendentes.filter((p) => {
    const lancador = ladoDe(p, p.lancado_por)
    return lancador !== undefined && lancador !== ladoDe(p, eu)
  })
  const aguardandoOutro = pendentes.filter((p) => !aguardandoMim.includes(p))
  const historico = minhas.filter((p) => p.status !== 'pendente')

  return (
    <div className="space-y-6 pb-20">
      <h1 className="text-xl font-bold">Partidas</h1>
      {isPending && <p className="text-sm text-gray-500">Carregando...</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          Não foi possível carregar as partidas.
        </p>
      )}
      {data && (
        <>
          <section className="space-y-2">
            <h2 className="font-semibold">Aguardando sua confirmação</h2>
            {aguardandoMim.length === 0 && <p className="text-sm text-gray-600">Nada pendente.</p>}
            {aguardandoMim.map((p) => (
              <PartidaCard key={p.id} partida={p} euId={eu}>
                <Acoes partida={p} />
              </PartidaCard>
            ))}
          </section>
          <section className="space-y-2">
            <h2 className="font-semibold">Aguardando o adversário</h2>
            {aguardandoOutro.length === 0 && <p className="text-sm text-gray-600">Nada pendente.</p>}
            {aguardandoOutro.map((p) => (
              <PartidaCard key={p.id} partida={p} euId={eu}>
                <p className="text-sm text-gray-600">confirma automaticamente em {horasRestantes(p.created_at)}h</p>
              </PartidaCard>
            ))}
          </section>
          <section className="space-y-2">
            <h2 className="font-semibold">Histórico</h2>
            {historico.length === 0 && <p className="text-sm text-gray-600">Nenhuma partida ainda.</p>}
            {historico.map((p) => (
              <PartidaCard key={p.id} partida={p} euId={eu} />
            ))}
          </section>
        </>
      )}
      {!perfil?.is_admin && (
      <Link
        to="/partidas/nova"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 rounded-full bg-green-800 px-5 py-3 font-semibold text-white shadow-lg"
      >
        Lançar resultado
      </Link>
      )}
    </div>
  )
}
