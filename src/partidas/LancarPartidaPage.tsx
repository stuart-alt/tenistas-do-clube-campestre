import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { CLASSE_BOTAO, CLASSE_INPUT } from '../auth/Campo'
import { traduzirErro } from '../lib/erros'
import { formatarData, hojeLocal } from '../lib/datas'
import PlacarInput, { type SetPlacar } from './PlacarInput'

type Jogador = { id: string; nome: string; foto_url: string | null; categoria: string | null }
type Vaga = { posicao: number; jogador_id: string | null }

function somaDias(iso: string, dias: number) {
  const [a, m, d] = iso.split('-').map(Number)
  return hojeLocal(new Date(a, m - 1, d + dias))
}

function Seletor({
  rotulo,
  valor,
  onChange,
  jogadores,
  excluir,
}: {
  rotulo: string
  valor: string
  onChange: (id: string) => void
  jogadores: Jogador[]
  excluir: string[]
}) {
  const [busca, setBusca] = useState('')
  const opcoes = jogadores.filter(
    (j) => j.id === valor || (!excluir.includes(j.id) && j.nome.toLowerCase().includes(busca.toLowerCase())),
  )
  return (
    <div className="space-y-1">
      <input
        type="search"
        aria-label={`Buscar ${rotulo}`}
        placeholder={`Buscar ${rotulo.toLowerCase()} por nome`}
        className={CLASSE_INPUT}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{rotulo}</span>
        <select className={CLASSE_INPUT} value={valor} onChange={(e) => onChange(e.target.value)}>
          <option value="">Selecione</option>
          {opcoes.map((j) => (
            <option key={j.id} value={j.id}>
              {j.nome}
              {j.categoria ? ` (${j.categoria})` : ''}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

export default function LancarPartidaPage() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const salaId = params.get('sala')
  const eu = perfil?.id ?? ''
  const hoje = hojeLocal()

  const [modalidade, setModalidade] = useState<'simples' | 'duplas'>('simples')
  const [data, setData] = useState(hoje)
  const [parceiro, setParceiro] = useState('')
  const [adv1, setAdv1] = useState('')
  const [adv2, setAdv2] = useState('')
  const [sets, setSets] = useState<SetPlacar[]>([{ l1: 0, l2: 0, stb: false }])
  const [erro, setErro] = useState('')

  const jogadoresQ = useQuery({
    queryKey: ['jogadores', 'ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, foto_url, categoria')
        .eq('ativo', true)
      if (error) throw error
      return [...((data ?? []) as Jogador[])].sort((a, b) => a.nome.localeCompare(b.nome))
    },
  })
  const salaQ = useQuery({
    queryKey: ['partidas', 'sala', salaId],
    enabled: !!salaId,
    queryFn: async () => {
      const { data, error } = await supabase.from('salas_lista').select('*').eq('id', salaId!).maybeSingle()
      if (error) throw error
      return data as { modalidade: string; data_hora: string; vagas: Vaga[] | null } | null
    },
  })

  const preenchida = useRef(false)
  useEffect(() => {
    const s = salaQ.data
    if (!s || preenchida.current || !eu) return
    preenchida.current = true
    const mod = s.modalidade === 'duplas' ? 'duplas' : 'simples'
    setModalidade(mod)
    const dia = hojeLocal(new Date(s.data_hora))
    if (dia <= hoje && dia >= somaDias(hoje, -7)) setData(dia)
    const ladoPos = (pos: number) => (mod === 'duplas' ? (pos <= 2 ? 1 : 2) : pos)
    let l1: string[] = []
    let l2: string[] = []
    for (const v of [...(s.vagas ?? [])].sort((a, b) => a.posicao - b.posicao)) {
      if (!v.jogador_id) continue
      if (ladoPos(v.posicao) === 1) l1.push(v.jogador_id)
      else l2.push(v.jogador_id)
    }
    if (l2.includes(eu)) [l1, l2] = [l2, l1]
    setParceiro(l1.filter((id) => id !== eu)[0] ?? '')
    setAdv1(l2[0] ?? '')
    setAdv2(l2[1] ?? '')
  }, [salaQ.data, eu, hoje])

  const registrar = useMutation({
    mutationFn: async () => {
      const lado1 = modalidade === 'duplas' ? [eu, parceiro] : [eu]
      const lado2 = modalidade === 'duplas' ? [adv1, adv2] : [adv1]
      const { error } = await supabase.rpc('registrar_partida', {
        p_modalidade: modalidade,
        p_data_jogo: data,
        p_lado1: lado1,
        p_lado2: lado2,
        p_sets: sets,
        p_sala_id: salaId ?? undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['partidas'] })
      void qc.invalidateQueries({ queryKey: ['ranking'] })
      navigate('/partidas')
    },
    onError: (e) => setErro(traduzirErro(e)),
  })

  const jogadores = jogadoresQ.data ?? []
  const escolhidos = [eu, parceiro, adv1, adv2].filter(Boolean)
  const completo = modalidade === 'duplas' ? !!(parceiro && adv1 && adv2) : !!adv1

  function enviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!completo) {
      setErro('Escolha todos os jogadores.')
      return
    }
    registrar.mutate()
  }

  return (
    <form onSubmit={enviar} className="space-y-4 pb-6">
      <h1 className="text-xl font-bold">Lançar resultado</h1>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Modalidade</span>
        <select
          className={CLASSE_INPUT}
          value={modalidade}
          onChange={(e) => {
            setModalidade(e.target.value as 'simples' | 'duplas')
            setParceiro('')
            setAdv2('')
          }}
        >
          <option value="simples">Simples</option>
          <option value="duplas">Duplas</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Data do jogo</span>
        <input
          type="date"
          className={CLASSE_INPUT}
          value={data}
          min={somaDias(hoje, -7)}
          max={hoje}
          onChange={(e) => setData(e.target.value)}
        />
        <span className="text-xs text-gray-500">Jogo em {formatarData(data)}</span>
      </label>
      <p className="text-sm">
        <span className="font-medium">{modalidade === 'duplas' ? 'Dupla 1' : 'Lado 1'}:</span> você
        {modalidade === 'duplas' && ' e seu parceiro'}
      </p>
      {modalidade === 'duplas' && (
        <Seletor rotulo="Parceiro" valor={parceiro} onChange={setParceiro} jogadores={jogadores} excluir={escolhidos} />
      )}
      <Seletor
        rotulo={modalidade === 'duplas' ? 'Adversário 1' : 'Adversário'}
        valor={adv1}
        onChange={setAdv1}
        jogadores={jogadores}
        excluir={escolhidos}
      />
      {modalidade === 'duplas' && (
        <Seletor rotulo="Adversário 2" valor={adv2} onChange={setAdv2} jogadores={jogadores} excluir={escolhidos} />
      )}
      <PlacarInput valor={sets} onChange={setSets} />
      {erro && (
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      )}
      <button type="submit" disabled={registrar.isPending} className={CLASSE_BOTAO}>
        Enviar resultado
      </button>
    </form>
  )
}
