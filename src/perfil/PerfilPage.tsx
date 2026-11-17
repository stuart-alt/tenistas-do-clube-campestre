import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { linkWhatsApp } from '../lib/whatsapp'
import { formatarData, hojeLocal, idadeEm } from '../lib/datas'
import GradeDisponibilidade from './GradeDisponibilidade'
import Estrelas from './Estrelas'
import Avatar from './Avatar'
import { HABILIDADES } from './EditarPerfilPage'
import CardJogador, { type PerfilCard } from './CardJogador'
import { compartilharOuBaixar, fotoComoDataUrl, svgParaPng } from './exportarCard'

export function BotaoWhatsApp({ telefone }: { telefone: string }) {
  const link = linkWhatsApp(telefone)
  if (!link) return null
  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      className="inline-block rounded bg-green-700 px-4 py-2 font-semibold text-white"
    >
      Chamar no WhatsApp
    </a>
  )
}

type PartidaLinha = {
  vitoria: boolean
  partidas: {
    id: string
    modalidade: string
    data_jogo: string
    partida_jogadores: { jogador_id: string; lado: number; profiles: { nome: string } | null }[]
    partida_sets: { ordem: number; games_lado1: number; games_lado2: number; super_tiebreak: boolean }[]
  }
}

function UltimasPartidas({ jogadorId }: { jogadorId: string }) {
  const { data } = useQuery({
    queryKey: ['ultimas-partidas', jogadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pontos_partida')
        .select(
          'vitoria, partidas!inner(id, modalidade, data_jogo, status, partida_jogadores(jogador_id, lado, profiles(nome)), partida_sets(ordem, games_lado1, games_lado2, super_tiebreak))',
        )
        .eq('jogador_id', jogadorId)
        .eq('partidas.status', 'confirmada')
        .order('data_jogo', { ascending: false })
        .limit(10)
      if (error) throw error
      return data as unknown as PartidaLinha[]
    },
  })

  return (
    <section>
      <h3 className="mb-2 font-semibold">Últimas partidas</h3>
      {data?.length === 0 && <p className="text-sm text-gray-600">Nenhuma partida confirmada.</p>}
      <ul className="space-y-2">
        {data?.map(({ vitoria, partidas: p }) => {
          const meuLado = p.partida_jogadores.find((x) => x.jogador_id === jogadorId)?.lado
          const adversarios = p.partida_jogadores
            .filter((x) => x.lado !== meuLado)
            .map((x) => x.profiles?.nome ?? '?')
            .join(' / ')
          const placar = [...p.partida_sets]
            .sort((a, b) => a.ordem - b.ordem)
            .map((s) => {
              const [meu, outro] = meuLado === 2 ? [s.games_lado2, s.games_lado1] : [s.games_lado1, s.games_lado2]
              return `${meu}-${outro}${s.super_tiebreak ? ' (STB)' : ''}`
            })
            .join(' ')
          return (
            <li key={p.id} className="flex items-center gap-2 rounded border p-2 text-sm">
              <span
                className={`w-6 text-center font-bold ${vitoria ? 'text-green-700' : 'text-red-700'}`}
                aria-label={vitoria ? 'Vitória' : 'Derrota'}
              >
                {vitoria ? 'V' : 'D'}
              </span>
              <span className="flex-1">
                <span className="block">
                  {formatarData(p.data_jogo)} · vs {adversarios}
                </span>
                <span className="text-gray-600">{placar}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Expirando({ jogadorId }: { jogadorId: string }) {
  const { data } = useQuery({
    queryKey: ['pontos-expirando', jogadorId],
    queryFn: async () => {
      const resultados = await Promise.all(
        (['simples', 'duplas'] as const).map(async (modalidade) => {
          const { data, error } = await supabase.rpc('pontos_expirando', {
            p_jogador: jogadorId,
            p_modalidade: modalidade,
          })
          if (error) throw error
          return { modalidade, linhas: data }
        }),
      )
      return resultados
    },
  })
  const hoje = hojeLocal()
  const avisos = (data ?? []).flatMap(({ modalidade, linhas }) =>
    linhas.map((l) => {
      const dias = Math.max(
        0,
        Math.round((Date.parse(l.expira_em.slice(0, 10)) - Date.parse(hoje)) / 86_400_000),
      )
      return { modalidade, pontos: l.pontos, dias }
    }),
  )
  if (avisos.length === 0) return null
  return (
    <div className="space-y-1">
      {avisos.map((a, i) => (
        <p key={i} role="status" className="rounded bg-yellow-100 p-2 text-sm">
          {a.pontos} pontos expiram em {a.dias} {a.dias === 1 ? 'dia' : 'dias'} ({a.modalidade})
        </p>
      ))}
    </div>
  )
}

function MeuCard({
  perfil,
  ranking,
}: {
  perfil: PerfilCard
  ranking: { modalidade: string; posicao: number; pontos: number }[]
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState(false)

  async function exportar() {
    if (!svgRef.current) return
    setOcupado(true)
    setErro(false)
    try {
      // A foto é embutida como data URL no clone, senão o PNG sairia sem ela.
      const foto = perfil.foto_url ? await fotoComoDataUrl(perfil.foto_url) : undefined
      const clone = svgRef.current.cloneNode(true) as SVGSVGElement
      if (foto) clone.querySelector('image')?.setAttribute('href', foto)
      else clone.querySelector('image')?.remove()
      const png = await svgParaPng(clone)
      const primeiro = perfil.nome
        .trim()
        .split(/\s+/)[0]
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
      await compartilharOuBaixar(png, `card-${primeiro}.png`)
    } catch {
      setErro(true)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="space-y-2">
      <h3 className="font-semibold">Meu card</h3>
      <div className="mx-auto w-full max-w-[320px]">
        <CardJogador ref={svgRef} perfil={perfil} ranking={ranking} />
      </div>
      <button
        type="button"
        onClick={exportar}
        disabled={ocupado}
        className="rounded bg-green-800 px-4 py-2 font-semibold text-white disabled:opacity-60"
      >
        {ocupado ? 'Gerando...' : 'Exportar card'}
      </button>
      {erro && (
        <p role="alert" className="text-sm text-red-700">
          Não foi possível gerar a imagem.
        </p>
      )}
    </section>
  )
}

export default function PerfilPage() {
  const { id } = useParams()
  const { perfil: eu } = useAuth()

  const { data: jogador, isPending } = useQuery({
    queryKey: ['perfil', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id!).maybeSingle()
      if (error) throw error
      return data
    },
  })
  const { data: posicoes } = useQuery({
    queryKey: ['ranking-jogador', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('ranking').select('modalidade, posicao, pontos').eq('jogador_id', id!)
      if (error) throw error
      return data
    },
  })

  if (isPending) return <p>Carregando...</p>
  if (!jogador) return <p>Jogador não encontrado. <Link to="/jogadores" className="underline">Voltar</Link></p>

  const rank = (m: string) => posicoes?.find((r) => r.modalidade === m)
  const posicao = (m: string) => {
    const p = rank(m)?.posicao
    return p != null ? `${p}º` : '—'
  }
  const pontos = (m: string) => rank(m)?.pontos ?? 0
  const proprio = eu?.id === jogador.id
  const linhasCard = (posicoes ?? []).flatMap((r) =>
    r.posicao != null ? [{ modalidade: r.modalidade, posicao: r.posicao, pontos: r.pontos ?? 0 }] : [],
  )

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center gap-4">
        <Avatar url={jogador.foto_url} nome={jogador.nome} tamanho="h-20 w-20" />
        <div>
          <h2 className="text-xl font-bold text-green-800">{jogador.nome}</h2>
          <p className="text-sm text-gray-600">
            {idadeEm(jogador.data_nascimento, hojeLocal())} anos · Categoria {jogador.categoria} ·{' '}
            {jogador.genero === 'feminino' ? 'Feminino' : 'Masculino'}
          </p>
        </div>
      </div>
      {proprio ? (
        <Link to="/perfil" className="inline-block rounded border border-green-800 px-3 py-1 text-sm text-green-800">
          Editar perfil
        </Link>
      ) : (
        <BotaoWhatsApp telefone={jogador.telefone} />
      )}
      <p className="font-medium">
        Simples: {posicao('simples')} · Duplas: {posicao('duplas')}
      </p>
      <p className="text-sm text-gray-600">
        Pontos: Simples {pontos('simples')} · Duplas {pontos('duplas')}
      </p>
      {proprio && <Expirando jogadorId={jogador.id} />}
      <section className="space-y-1">
        <h3 className="font-semibold">Habilidades</h3>
        {HABILIDADES.map(([campo, rotulo]) => (
          <Estrelas key={campo} rotulo={rotulo} valor={jogador[campo]} />
        ))}
      </section>
      {proprio && !eu?.is_admin && <MeuCard perfil={jogador} ranking={linhasCard} />}
      <section>
        <h3 className="mb-1 font-semibold">Disponibilidade</h3>
        <GradeDisponibilidade valor={jogador.disponibilidade} />
      </section>
      <UltimasPartidas jogadorId={jogador.id} />
    </div>
  )
}
