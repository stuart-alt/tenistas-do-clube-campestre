import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { traduzirErro } from '../lib/erros'
import { Campo, CartaoAuth, CLASSE_BOTAO } from './Campo'
import { useAuth } from './AuthProvider'

export default function RedefinirSenhaPage() {
  const { session, carregando } = useAuth()
  // Lido na primeira renderização: o Supabase pode limpar o hash depois de processá-lo
  const [erroNoLink] = useState(() => window.location.hash.includes('error='))
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) setErro(traduzirErro(error))
    else setPronto(true)
  }

  if (erroNoLink || (!carregando && !session && !pronto)) {
    return (
      <CartaoAuth titulo="Redefinir senha">
        <p>Link expirado ou já usado.</p>
        <p className="mt-4 text-sm">
          <Link to="/esqueci-senha" className="text-green-800 underline">
            Pedir um novo link
          </Link>
        </p>
      </CartaoAuth>
    )
  }
  if (carregando) return <CartaoAuth titulo="Redefinir senha">{null}</CartaoAuth>

  return (
    <CartaoAuth titulo="Redefinir senha">
      {pronto ? (
        <p>Senha alterada. Volte ao app e entre com a nova senha.</p>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <Campo rotulo="Nova senha" type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
          {erro && (
            <p role="alert" className="text-sm text-red-700">
              {erro}
            </p>
          )}
          <button type="submit" className={CLASSE_BOTAO}>
            Salvar nova senha
          </button>
        </form>
      )}
    </CartaoAuth>
  )
}
