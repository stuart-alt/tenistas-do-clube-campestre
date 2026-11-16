import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { traduzirErro } from '../lib/erros'
import { ERRO_CELULAR, normalizarTelefone } from '../lib/whatsapp'
import { Campo, CartaoAuth, CLASSE_BOTAO, CLASSE_INPUT } from './Campo'
import { destinoAposLogin } from './origem'

export default function CadastroPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [f, setF] = useState({
    nome: '',
    data_nascimento: '',
    email: '',
    telefone: '',
    genero: '',
    categoria: '',
    senha: '',
  })
  const [erro, setErro] = useState<string | null>(null)
  const [cadastrado, setCadastrado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const mudar = (campo: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((antes) => ({ ...antes, [campo]: e.target.value }))

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (f.senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    const telefone = normalizarTelefone(f.telefone)
    if (!telefone) {
      setErro(ERRO_CELULAR)
      return
    }
    setEnviando(true)
    const { data, error } = await supabase.auth.signUp({
      email: f.email,
      password: f.senha,
      options: {
        data: {
          nome: f.nome,
          data_nascimento: f.data_nascimento,
          telefone,
          genero: f.genero,
          categoria: f.categoria,
        },
      },
    })
    setEnviando(false)
    if (error) setErro(traduzirErro(error))
    else if (data.session) navigate(destinoAposLogin(state), { replace: true })
    else setCadastrado(true)
  }

  return (
    <CartaoAuth titulo="Cadastro">
      {cadastrado ? (
        <p>Cadastro feito. Entre com seu e-mail e senha.</p>
      ) : (
      <form onSubmit={enviar} className="space-y-4">
        <Campo rotulo="Nome" required value={f.nome} onChange={mudar('nome')} />
        <Campo
          rotulo="Data de nascimento"
          type="date"
          required
          value={f.data_nascimento}
          onChange={mudar('data_nascimento')}
        />
        <Campo rotulo="E-mail" type="email" required value={f.email} onChange={mudar('email')} />
        <Campo rotulo="Telefone (WhatsApp)" type="tel" required value={f.telefone} onChange={mudar('telefone')} />
        <div>
          <label htmlFor="genero" className="mb-1 block text-sm font-medium">
            Gênero
          </label>
          <select id="genero" required className={CLASSE_INPUT} value={f.genero} onChange={mudar('genero')}>
            <option value="">Selecione</option>
            <option value="masculino">Masculino</option>
            <option value="feminino">Feminino</option>
          </select>
        </div>
        <div>
          <label htmlFor="categoria" className="mb-1 block text-sm font-medium">
            Categoria
          </label>
          <select id="categoria" required className={CLASSE_INPUT} value={f.categoria} onChange={mudar('categoria')}>
            <option value="">Selecione</option>
            {['A', 'B', 'C', 'D'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <Campo rotulo="Senha" type="password" required value={f.senha} onChange={mudar('senha')} />
        {erro && (
          <p role="alert" className="text-sm text-red-700">
            {erro}
          </p>
        )}
        <button type="submit" disabled={enviando} className={CLASSE_BOTAO}>
          Cadastrar
        </button>
      </form>
      )}
      <p className="mt-4 text-sm">
        Já tem conta?{' '}
        <Link to="/entrar" className="text-green-800 underline">
          Entrar
        </Link>
      </p>
    </CartaoAuth>
  )
}
