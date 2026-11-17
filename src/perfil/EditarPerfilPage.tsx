import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { traduzirErro } from '../lib/erros'
import { ERRO_CELULAR, normalizarTelefone } from '../lib/whatsapp'
import { Campo, CLASSE_BOTAO, CLASSE_INPUT } from '../auth/Campo'
import GradeDisponibilidade from './GradeDisponibilidade'
import Estrelas from './Estrelas'
import FotoUpload from './FotoUpload'
import Avatar from './Avatar'

export const HABILIDADES = [
  ['forehand', 'Forehand'],
  ['backhand', 'Backhand'],
  ['saque', 'Saque'],
  ['voleio', 'Voleio'],
  ['velocidade', 'Velocidade'],
  ['resistencia', 'Resistência'],
] as const

export default function EditarPerfilPage() {
  const { perfil, recarregarPerfil } = useAuth()
  const qc = useQueryClient()
  const [f, setF] = useState(() => ({
    nome: perfil?.nome ?? '',
    telefone: perfil?.telefone ?? '',
    data_nascimento: perfil?.data_nascimento ?? '',
    genero: perfil?.genero ?? 'masculino',
    categoria: perfil?.categoria ?? 'D',
    foto_url: perfil?.foto_url ?? null,
    forehand: perfil?.forehand ?? 1,
    backhand: perfil?.backhand ?? 1,
    saque: perfil?.saque ?? 1,
    voleio: perfil?.voleio ?? 1,
    velocidade: perfil?.velocidade ?? 1,
    resistencia: perfil?.resistencia ?? 1,
    disponibilidade: perfil?.disponibilidade ?? [],
  }))
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [salvando, setSalvando] = useState(false)

  if (!perfil) return null

  async function fotoEnviada(url: string) {
    setMsg(null)
    const { error } = await supabase.from('profiles').update({ foto_url: url }).eq('id', perfil!.id)
    if (error) {
      setMsg({ ok: false, texto: traduzirErro(error) })
      return
    }
    setF((a) => ({ ...a, foto_url: url }))
    await recarregarPerfil()
    await qc.invalidateQueries({ queryKey: ['perfil', perfil!.id] })
    await qc.invalidateQueries({ queryKey: ['card-foto'] })
    setMsg({ ok: true, texto: 'Foto atualizada.' })
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    const telefone = normalizarTelefone(f.telefone)
    if (!telefone) {
      setMsg({ ok: false, texto: ERRO_CELULAR })
      return
    }
    setSalvando(true)
    const { error } = await supabase.from('profiles').update({ ...f, telefone }).eq('id', perfil!.id)
    setSalvando(false)
    if (error) {
      setMsg({ ok: false, texto: traduzirErro(error) })
    } else {
      await recarregarPerfil()
      setMsg({ ok: true, texto: 'Perfil salvo.' })
    }
  }

  return (
    <form onSubmit={salvar} className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-green-800">Meu perfil</h2>
        <Link to={`/jogadores/${perfil.id}`} className="text-sm text-green-800 underline">
          Ver meu perfil
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <Avatar url={f.foto_url} nome={f.nome} tamanho="h-20 w-20" />
        <FotoUpload onEnviada={fotoEnviada} />
      </div>
      <Campo rotulo="Nome" required value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
      <Campo
        rotulo="Telefone (WhatsApp)"
        type="tel"
        required
        value={f.telefone}
        onChange={(e) => setF({ ...f, telefone: e.target.value })}
      />
      <Campo
        rotulo="Data de nascimento"
        type="date"
        required
        value={f.data_nascimento}
        onChange={(e) => setF({ ...f, data_nascimento: e.target.value })}
      />
      <div>
        <label htmlFor="genero" className="mb-1 block text-sm font-medium">
          Gênero
        </label>
        <select
          id="genero"
          className={CLASSE_INPUT}
          value={f.genero}
          onChange={(e) => setF({ ...f, genero: e.target.value })}
        >
          <option value="masculino">Masculino</option>
          <option value="feminino">Feminino</option>
        </select>
      </div>
      <div>
        <label htmlFor="categoria" className="mb-1 block text-sm font-medium">
          Categoria
        </label>
        <select
          id="categoria"
          className={CLASSE_INPUT}
          value={f.categoria}
          onChange={(e) => setF({ ...f, categoria: e.target.value })}
        >
          {['A', 'B', 'C', 'D'].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <section className="space-y-1">
        <h3 className="font-semibold">Habilidades</h3>
        {HABILIDADES.map(([campo, rotulo]) => (
          <Estrelas key={campo} rotulo={rotulo} valor={f[campo]} onChange={(n) => setF((a) => ({ ...a, [campo]: n }))} />
        ))}
      </section>
      <section>
        <h3 className="mb-1 font-semibold">Disponibilidade</h3>
        <GradeDisponibilidade valor={f.disponibilidade} onChange={(v) => setF((a) => ({ ...a, disponibilidade: v }))} />
      </section>
      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>
          {msg.texto}
        </p>
      )}
      <button type="submit" disabled={salvando} className={CLASSE_BOTAO}>
        Salvar
      </button>
      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        className="w-full rounded border border-gray-300 px-4 py-2"
      >
        Sair
      </button>
      {!perfil.is_admin && (
        <Link to="/contato" className="block text-center text-sm text-green-800 underline">
          Fale com o administrador
        </Link>
      )}
    </form>
  )
}
