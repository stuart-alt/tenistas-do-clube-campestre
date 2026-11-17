import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { traduzirErro } from '../lib/erros'
import { formatarData } from '../lib/datas'
import { CLASSE_BOTAO, CLASSE_INPUT } from '../auth/Campo'

export const TIPOS_MENSAGEM = { duvida: 'Dúvida', sugestao: 'Sugestão', problema: 'Problema' } as const
type TipoMensagem = keyof typeof TIPOS_MENSAGEM

type Minha = { id: string; tipo: string; texto: string; resposta: string | null; created_at: string }

export default function ContatoPage() {
  const qc = useQueryClient()
  const [tipo, setTipo] = useState<TipoMensagem>('duvida')
  const [texto, setTexto] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  const { data: minhas = [] } = useQuery({
    queryKey: ['mensagens_admin', 'minhas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mensagens_admin')
        .select('id, tipo, texto, resposta, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Minha[]
    },
  })

  const enviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('enviar_mensagem_admin', { p_tipo: tipo, p_texto: texto.trim() })
      if (error) throw error
    },
    onSuccess: () => {
      setTexto('')
      setMsg({ ok: true, texto: 'Mensagem enviada. Você será avisado no sininho quando houver resposta.' })
      void qc.invalidateQueries({ queryKey: ['mensagens_admin'] })
    },
    onError: (e) => setMsg({ ok: false, texto: traduzirErro(e) }),
  })

  function submeter(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (!texto.trim()) return
    enviar.mutate()
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <form onSubmit={submeter} className="space-y-3">
        <h2 className="text-xl font-bold text-green-800">Fale com o administrador</h2>
        <div>
          <label htmlFor="tipo-mensagem" className="mb-1 block text-sm font-medium">
            Tipo
          </label>
          <select
            id="tipo-mensagem"
            className={CLASSE_INPUT}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoMensagem)}
          >
            {Object.entries(TIPOS_MENSAGEM).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="texto-mensagem" className="mb-1 block text-sm font-medium">
            Mensagem
          </label>
          <textarea
            id="texto-mensagem"
            className={CLASSE_INPUT}
            rows={5}
            maxLength={2000}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <p className="text-right text-xs text-gray-500">{texto.length}/2000</p>
        </div>
        {msg && (
          <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>
            {msg.texto}
          </p>
        )}
        <button type="submit" disabled={!texto.trim() || enviar.isPending} className={CLASSE_BOTAO}>
          Enviar
        </button>
      </form>

      <section className="space-y-2">
        <h3 className="font-semibold">Minhas mensagens</h3>
        {minhas.length === 0 && <p className="text-sm text-gray-600">Você ainda não enviou mensagens.</p>}
        <ul className="space-y-2">
          {minhas.map((m) => (
            <li key={m.id} className="rounded border p-3 text-sm">
              <p className="text-xs text-gray-600">
                {TIPOS_MENSAGEM[m.tipo as TipoMensagem] ?? m.tipo} · {formatarData(m.created_at)}
              </p>
              <p className="whitespace-pre-wrap">{m.texto}</p>
              {m.resposta && (
                <div className="mt-2 rounded bg-green-50 p-2">
                  <p className="text-xs font-bold text-green-800">Resposta do administrador:</p>
                  <p className="whitespace-pre-wrap">{m.resposta}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
