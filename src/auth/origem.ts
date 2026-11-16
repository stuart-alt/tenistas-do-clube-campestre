import type { Location } from 'react-router-dom'

/** Caminho interno para onde voltar após entrar/cadastrar; '/' se ausente ou inválido. */
export function destinoAposLogin(state: unknown): string {
  const de = (state as { de?: Pick<Location, 'pathname' | 'search'> } | null)?.de
  if (!de || typeof de.pathname !== 'string') return '/'
  const caminho = de.pathname + (typeof de.search === 'string' ? de.search : '')
  return caminho.startsWith('/') && !caminho.startsWith('//') ? caminho : '/'
}
