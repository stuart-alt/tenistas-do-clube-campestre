import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { traduzirErro } from '../lib/erros'
import { Campo, CartaoAuth, CLASSE_BOTAO } from './Campo'

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + import.meta.env.BASE_URL + 'redefinir-senha',
    })
    if (error) setErro(traduzirErro(error))
    else setEnviado(true)
  }

  return (
    <CartaoAuth titulo="Esqueci minha senha">
      {enviado ? (
        <p>Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.</p>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <Campo rotulo="E-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          {erro && (
            <p role="alert" className="text-sm text-red-700">
              {erro}
            </p>
          )}
          <button type="submit" className={CLASSE_BOTAO}>
            Enviar link
          </button>
        </form>
      )}
      <p className="mt-4 text-sm">
        <Link to="/entrar" className="text-green-800 underline">
          Voltar
        </Link>
      </p>
    </CartaoAuth>
  )
}
