import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'

export type Perfil = Database['public']['Tables']['profiles']['Row']

type AuthValor = {
  session: Session | null
  perfil: Perfil | null
  carregando: boolean
  recarregarPerfil(): Promise<void>
}

const AuthContexto = createContext<AuthValor | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [carregandoSessao, setCarregandoSessao] = useState(true)
  const [perfilBuscadoPara, setPerfilBuscadoPara] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCarregandoSessao(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, nova) => {
      setSession(nova)
      setCarregandoSessao(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  const buscarPerfil = useCallback(async () => {
    if (!userId) {
      setPerfil(null)
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setPerfil(data)
  }, [userId])

  useEffect(() => {
    let ativo = true
    buscarPerfil().finally(() => {
      if (ativo) setPerfilBuscadoPara(userId)
    })
    return () => {
      ativo = false
    }
  }, [buscarPerfil, userId])

  const valor = useMemo<AuthValor>(
    () => ({
      session,
      perfil,
      carregando: carregandoSessao || (userId !== null && perfilBuscadoPara !== userId),
      recarregarPerfil: buscarPerfil,
    }),
    [session, perfil, userId, carregandoSessao, perfilBuscadoPara, buscarPerfil],
  )

  return <AuthContexto.Provider value={valor}>{children}</AuthContexto.Provider>
}

export function useAuth(): AuthValor {
  const ctx = useContext(AuthContexto)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
