import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { traduzirErro } from '../lib/erros'
import AvisoForm, { type Aviso } from './AvisoForm'

export default function AvisosPage() {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const [editando, setEditando] = useState<Aviso | 'novo' | null>(null)
  const [erro, setErro] = useState('')

  const { data = [], isLoading } = useQuery({
    queryKey: ['avisos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avisos')
        .select('*')
        .order('fixado', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      const lista = (data ?? []) as unknown as Aviso[]
      return [...lista].sort(
        (a, b) => Number(b.fixado) - Number(a.fixado) || b.created_at.localeCompare(a.created_at),
      )
    },
  })

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('avisos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['avisos'] }),
    onError: (e) => setErro(traduzirErro(e)),
  })

  const admin = !!perfil?.is_admin

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Avisos</h2>
        {admin && !editando && (
          <button onClick={() => setEditando('novo')} className="rounded bg-green-800 px-3 py-2 text-sm font-bold text-white">
            Novo aviso
          </button>
        )}
      </div>
      {erro && (
        <p role="alert" className="text-red-700">
          {erro}
        </p>
      )}
      {admin && editando && (
        <AvisoForm
          key={editando === 'novo' ? 'novo' : editando.id}
          aviso={editando === 'novo' ? undefined : editando}
          aoFechar={() => setEditando(null)}
        />
      )}
      {isLoading && <p>Carregando...</p>}
      {!isLoading && data.length === 0 && <p className="text-gray-600">Nenhum aviso.</p>}
      {data.map((a) => (
        <article key={a.id} className="space-y-2 rounded border p-3">
          <h3 className="font-bold">
            {a.fixado && <span aria-label="Fixado">📌 </span>}
            {a.titulo}
          </h3>
          <div className="space-y-2 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5">
            <ReactMarkdown>{a.corpo_md}</ReactMarkdown>
          </div>
          {admin && (
            <div className="flex gap-3 text-sm">
              <button onClick={() => setEditando(a)} className="underline">
                Editar
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Excluir este aviso?')) excluir.mutate(a.id)
                }}
                className="text-red-700 underline"
              >
                Excluir
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  )
}
