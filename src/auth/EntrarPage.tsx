import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { traduzirErro } from '../lib/erros'
import { Campo, CartaoAuth, CLASSE_BOTAO } from './Campo'
import { destinoAposLogin } from './origem'

export default function EntrarPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setEnviando(false)
    if (error) setErro(traduzirErro(error))
    else navigate(destinoAposLogin(state), { replace: true })
  }

  return (
    <CartaoAuth titulo="Entrar">
      <form onSubmit={enviar} className="space-y-4">
        <Campo rotulo="E-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Campo rotulo="Senha" type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        {erro && (
          <p role="alert" className="text-sm text-red-700">
            {erro}
          </p>
        )}
        <button type="submit" disabled={enviando} className={CLASSE_BOTAO}>
          Entrar
        </button>
      </form>
      <p className="mt-4 text-sm">
        <Link to="/esqueci-senha" className="text-green-800 underline">
          Esqueci minha senha
        </Link>
      </p>
      <p className="mt-2 text-sm">
        Primeira vez?{' '}
        <Link to="/cadastro" state={state} className="text-green-800 underline">
          Cadastre-se
        </Link>
      </p>
    </CartaoAuth>
  )
}
