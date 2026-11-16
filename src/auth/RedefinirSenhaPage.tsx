import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { traduzirErro } from '../lib/erros'
import { Campo, CartaoAuth, CLASSE_BOTAO } from './Campo'

export default function RedefinirSenhaPage() {
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
