import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { traduzirErro } from '../lib/erros'
import { CLASSE_INPUT } from '../auth/Campo'

export type Aviso = {
  id: string
  titulo: string
  corpo_md: string
  fixado: boolean
  created_at: string
}

export default function AvisoForm({ aviso, aoFechar }: { aviso?: Aviso; aoFechar: () => void }) {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const [titulo, setTitulo] = useState(aviso?.titulo ?? '')
  const [corpo, setCorpo] = useState(aviso?.corpo_md ?? '')
  const [fixado, setFixado] = useState(aviso?.fixado ?? false)
  const [erro, setErro] = useState('')

  const salvar = useMutation({
    mutationFn: async () => {
      const campos = { titulo: titulo.trim(), corpo_md: corpo, fixado }
      const { error } = aviso
        ? await supabase.from('avisos').update(campos).eq('id', aviso.id)
        : await supabase.from('avisos').insert({ ...campos, autor: perfil!.id })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['avisos'] })
      aoFechar()
    },
    onError: (e) => setErro(traduzirErro(e)),
  })

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    if (!titulo.trim() || !corpo.trim()) return setErro('Preencha título e texto.')
    salvar.mutate()
  }

  return (
    <form onSubmit={enviar} className="space-y-3 rounded border p-3">
      <label className="block">
        Título
        <input className={CLASSE_INPUT} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </label>
      <label className="block">
        Texto
        <textarea className={CLASSE_INPUT} rows={5} value={corpo} onChange={(e) => setCorpo(e.target.value)} />
      </label>
      <p className="text-xs text-gray-600">**negrito**, *itálico*, - lista, [link](url)</p>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={fixado} onChange={(e) => setFixado(e.target.checked)} />
        Fixado
      </label>
      {erro && (
        <p role="alert" className="text-red-700">
          {erro}
        </p>
      )}
      <div className="flex gap-2">
        <button disabled={salvar.isPending} className="rounded bg-green-800 px-3 py-2 font-bold text-white">
          Salvar
        </button>
        <button type="button" onClick={aoFechar} className="rounded border px-3 py-2">
          Cancelar
        </button>
      </div>
    </form>
  )
}
