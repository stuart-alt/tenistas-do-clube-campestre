import type { ReactNode } from 'react'
import { formatarData } from '../lib/datas'
import NaoContou from './NaoContou'

export type PartidaDetalhe = {
  id: string
  modalidade: string
  data_jogo: string
  status: string
  lancado_por: string
  motivo_contestacao: string | null
  created_at: string
  partida_jogadores: {
    jogador_id: string
    lado: number
    profiles: { nome: string; foto_url: string | null } | null
  }[]
  partida_sets: { ordem: number; games_lado1: number; games_lado2: number; super_tiebreak: boolean }[]
  pontos_partida: { jogador_id: string; vitoria: boolean; pontos: number; bonus: number; conta?: boolean }[]
}

const ROTULO_STATUS: Record<string, string> = {
  pendente: 'Pendente',
  confirmada: 'Confirmada',
  contestada: 'Contestada',
  cancelada: 'Cancelada',
}

export function placarTexto(p: Pick<PartidaDetalhe, 'partida_sets'>): string {
  return [...p.partida_sets]
    .sort((a, b) => a.ordem - b.ordem)
    .map((s) => (s.super_tiebreak ? `[${s.games_lado1}-${s.games_lado2}]` : `${s.games_lado1}-${s.games_lado2}`))
    .join(' ')
}

export default function PartidaCard({
  partida,
  euId,
  children,
}: {
  partida: PartidaDetalhe
  euId?: string
  children?: ReactNode
}) {
  const nomes = (lado: number) =>
    partida.partida_jogadores
      .filter((j) => j.lado === lado)
      .map((j) => j.profiles?.nome ?? '?')
      .join(' / ')
  const meus = euId ? partida.pontos_partida.find((p) => p.jogador_id === euId) : undefined

  return (
    <article className="space-y-1 rounded border border-gray-200 p-3">
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>
          {formatarData(partida.data_jogo)} · {partida.modalidade === 'duplas' ? 'Duplas' : 'Simples'}
        </span>
        <span>{ROTULO_STATUS[partida.status] ?? partida.status}</span>
      </div>
      <p className="text-sm font-medium">
        {nomes(1)} <span className="font-normal text-gray-500">x</span> {nomes(2)}
      </p>
      <p className="text-lg font-bold">{placarTexto(partida)}</p>
      {meus && (
        <p className="text-sm text-green-800">
          {meus.vitoria ? 'Vitória' : 'Derrota'}: +{meus.pontos + meus.bonus} pts
        </p>
      )}
      {meus?.conta === false && <NaoContou modalidade={partida.modalidade} />}
      {partida.status === 'contestada' && partida.motivo_contestacao && (
        <p className="text-sm text-gray-700">Motivo: {partida.motivo_contestacao}</p>
      )}
      {children}
    </article>
  )
}
