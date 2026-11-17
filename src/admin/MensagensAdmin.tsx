import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { traduzirErro } from '../lib/erros'
import { formatarData } from '../lib/datas'
import { CLASSE_INPUT } from '../auth/Campo'
import { TIPOS_MENSAGEM } from '../contato/ContatoPage'

type Mensagem = {
  id: string
  tipo: string
  texto: string
  resposta: string | null
  created_at: string
  profiles: { nome: string } | null
}

function Item({ m }: { m: Mensagem }) {
  const qc = useQueryClient()
  const [resposta, setResposta] = useState('')
  const [erro, setErro] = useState('')
  const responder = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('responder_mensagem_admin', { p_id: m.id, p_resposta: resposta.trim() })
      if (error) throw error
    },
    onSuccess: () => {
      setResposta('')
      setErro('')
      void qc.invalidateQueries({ queryKey: ['mensagens_admin'] })
    },
    onError: (e) => setErro(traduzirErro(e)),
  })
  const idCampo = `resposta-${m.id}`
  return (
    <li className="space-y-2 rounded border p-3 text-sm">
      <p className="text-xs text-gray-600">
        <span className="font-bold">{m.profiles?.nome ?? 'Jogador'}</span> ·{' '}
        {TIPOS_MENSAGEM[m.tipo as keyof typeof TIPOS_MENSAGEM] ?? m.tipo} · {formatarData(m.created_at)}
      </p>
      <p className="whitespace-pre-wrap">{m.texto}</p>
      {m.resposta && (
        <div className="rounded bg-green-50 p-2">
          <p className="text-xs font-bold text-green-800">Resposta do administrador:</p>
          <p className="whitespace-pre-wrap">{m.resposta}</p>
        </div>
      )}
      <label htmlFor={idCampo} className="block text-xs font-medium">
        Resposta
      </label>
      <textarea
        id={idCampo}
        className={CLASSE_INPUT}
        rows={3}
        maxLength={2000}
        value={resposta}
        onChange={(e) => setResposta(e.target.value)}
      />
      {erro && (
        <p role="alert" className="text-red-700">
          {erro}
        </p>
      )}
      <button
        type="button"
        disabled={!resposta.trim() || responder.isPending}
        onClick={() => responder.mutate()}
        className="rounded bg-green-800 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
      >
        Responder
      </button>
    </li>
  )
}

export default function MensagensAdmin() {
  const { data, isPending, error } = useQuery({
    queryKey: ['mensagens_admin', 'todas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mensagens_admin')
        .select('id, tipo, texto, resposta, created_at, profiles!mensagens_admin_autor_fkey(nome)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Mensagem[]
    },
  })
  // Sem resposta primeiro; dentro de cada grupo mantém a ordem (mais recentes antes)
  const lista = [...(data ?? [])].sort((a, b) => Number(a.resposta !== null) - Number(b.resposta !== null))
  return (
    <div className="space-y-3">
      {isPending && <p className="text-sm text-gray-500">Carregando...</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          Não foi possível carregar as mensagens.
        </p>
      )}
      {!isPending && !error && lista.length === 0 && <p className="text-sm text-gray-600">Nenhuma mensagem.</p>}
      <ul className="space-y-2">
        {lista.map((m) => (
          <Item key={m.id} m={m} />
        ))}
      </ul>
    </div>
  )
}
