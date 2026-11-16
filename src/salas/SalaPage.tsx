import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { traduzirErro } from '../lib/erros'
import Avatar from '../perfil/Avatar'
import { formatarDiaHora, totalVagas, type SalaLista } from './tipos'

type Acao = { rpc: 'entrar_sala' | 'sair_sala' | 'cancelar_sala'; posicao?: number }

export default function SalaPage() {
  const { id = '' } = useParams()
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [erro, setErro] = useState('')

  const { data: sala, isLoading } = useQuery({
    queryKey: ['salas', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('salas_lista').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data as unknown as SalaLista | null
    },
  })

  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ['salas'] })
    void qc.invalidateQueries({ queryKey: ['notificacoes'] })
  }

  const acao = useMutation({
    mutationFn: async (a: Acao) => {
      const { error } =
        a.rpc === 'entrar_sala'
          ? await supabase.rpc('entrar_sala', { p_sala: id, p_posicao: a.posicao as number })
          : await supabase.rpc(a.rpc, { p_sala: id })
      if (error) throw error
      return a.rpc
    },
    onSuccess: (r) => {
      setErro('')
      recarregar()
      if (r === 'cancelar_sala') navigate('/salas')
    },
    onError: (e) => {
      setErro(traduzirErro(e))
      recarregar()
    },
  })

  if (isLoading) return <p>Carregando...</p>
  if (!sala) return <p>Sala não encontrada ou encerrada.</p>

  const vagas = sala.vagas ?? []
  const total = totalVagas(sala.modalidade)
  const ehAdmin = !!perfil?.is_admin
  const meu = vagas.some((v) => v.jogador_id === perfil?.id)
  const podeCancelar = sala.criador === perfil?.id || !!perfil?.is_admin
  const { dia, hora } = formatarDiaHora(sala.data_hora)
  const jaPassou = new Date(sala.data_hora).getTime() <= Date.now()

  const renderVaga = (posicao: number) => {
    const v = vagas.find((x) => x.posicao === posicao)
    return (
      <li key={posicao} className="flex items-center gap-3 rounded border p-2">
        {v ? (
          <Link to={`/jogadores/${v.jogador_id}`} className="flex items-center gap-3">
            <Avatar url={v.foto_url} nome={v.nome} tamanho="h-10 w-10" />
            <span>{v.nome}</span>
          </Link>
        ) : (
          <>
            <span className="flex-1 text-gray-500">Vaga livre</span>
            {!meu && !ehAdmin && sala.status === 'aberta' && (
              <button
                disabled={acao.isPending}
                onClick={() => acao.mutate({ rpc: 'entrar_sala', posicao })}
                className="rounded bg-green-800 px-3 py-1 text-sm font-bold text-white"
              >
                Entrar aqui
              </button>
            )}
          </>
        )}
      </li>
    )
  }

  const posicoes = (ini: number, fim: number) => Array.from({ length: fim - ini + 1 }, (_, i) => ini + i)

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Sala de {sala.modalidade === 'duplas' ? 'duplas' : 'simples'}</h2>
      <p className="capitalize">
        {dia} às {hora} · {sala.status === 'confirmada' ? 'Confirmada' : 'Aberta'}
      </p>
      {sala.recado && <p className="text-gray-700">{sala.recado}</p>}
      {total === 4 ? (
        <>
          <h3 className="font-bold">Dupla 1</h3>
          <ul className="space-y-2">{posicoes(1, 2).map(renderVaga)}</ul>
          <h3 className="font-bold">Dupla 2</h3>
          <ul className="space-y-2">{posicoes(3, 4).map(renderVaga)}</ul>
        </>
      ) : (
        <ul className="space-y-2">{posicoes(1, 2).map(renderVaga)}</ul>
      )}
      {erro && (
        <p role="alert" className="text-red-700">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {sala.status === 'confirmada' && jaPassou && !ehAdmin && (
          <Link to={`/partidas/nova?sala=${sala.id}`} className="rounded bg-green-800 px-3 py-2 font-bold text-white">
            Lançar resultado
          </Link>
        )}
        {meu && (
          <button onClick={() => acao.mutate({ rpc: 'sair_sala' })} className="rounded border px-3 py-2">
            Sair
          </button>
        )}
        {podeCancelar && (
          <button
            onClick={() => acao.mutate({ rpc: 'cancelar_sala' })}
            className="rounded border border-red-700 px-3 py-2 text-red-700"
          >
            Cancelar sala
          </button>
        )}
      </div>
    </div>
  )
}
