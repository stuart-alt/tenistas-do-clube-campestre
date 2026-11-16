import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { traduzirErro } from '../lib/erros'
import { CLASSE_INPUT } from '../auth/Campo'
import { useAuth } from '../auth/AuthProvider'

export default function NovaSalaPage() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [modalidade, setModalidade] = useState('simples')
  const [dataHora, setDataHora] = useState('')
  const [recado, setRecado] = useState('')
  const [dupla, setDupla] = useState('1')
  const [erro, setErro] = useState('')

  const criar = useMutation({
    mutationFn: async () => {
      const posicao = modalidade === 'duplas' && dupla === '2' ? 3 : 1
      const { data, error } = await supabase.rpc('criar_sala', {
        p_modalidade: modalidade,
        p_data_hora: new Date(dataHora).toISOString(),
        p_recado: recado.trim(),
        p_posicao: posicao,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: ['salas'] })
      navigate(`/salas/${id}`)
    },
    onError: (e) => setErro(traduzirErro(e)),
  })

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    if (!dataHora) return setErro('Informe data e hora.')
    criar.mutate()
  }

  if (perfil?.is_admin) return <p className="text-gray-700">Contas de administrador não participam de jogos.</p>

  return (
    <form onSubmit={enviar} className="space-y-3">
      <h2 className="text-xl font-bold">Nova sala</h2>
      <label className="block">
        Tipo
        <select className={CLASSE_INPUT} value={modalidade} onChange={(e) => setModalidade(e.target.value)}>
          <option value="simples">Simples</option>
          <option value="duplas">Duplas</option>
        </select>
      </label>
      <label className="block">
        Data e hora
        <input type="datetime-local" className={CLASSE_INPUT} value={dataHora} onChange={(e) => setDataHora(e.target.value)} />
      </label>
      <label className="block">
        Recado
        <input className={CLASSE_INPUT} value={recado} maxLength={200} onChange={(e) => setRecado(e.target.value)} />
      </label>
      {modalidade === 'duplas' && (
        <label className="block">
          Minha vaga
          <select className={CLASSE_INPUT} value={dupla} onChange={(e) => setDupla(e.target.value)}>
            <option value="1">Dupla 1</option>
            <option value="2">Dupla 2</option>
          </select>
        </label>
      )}
      {erro && (
        <p role="alert" className="text-red-700">
          {erro}
        </p>
      )}
      <button disabled={criar.isPending} className="w-full rounded bg-green-800 py-2 font-bold text-white">
        Criar sala
      </button>
    </form>
  )
}
