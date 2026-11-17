export type NomeNivel = 'bronze' | 'prata' | 'ouro' | 'diamante'

const NIVEIS: NomeNivel[] = ['bronze', 'prata', 'ouro', 'diamante']
const CORES = [
  'bg-amber-100 text-amber-900',
  'bg-gray-200 text-gray-800',
  'bg-yellow-200 text-yellow-900',
  'bg-cyan-100 text-cyan-900',
]

const indice = (nivel: number) => Math.min(Math.max(nivel, 1), 4) - 1

export function nomeNivel(nivel: number): NomeNivel {
  return NIVEIS[indice(nivel)]
}

export function corNivel(nivel: number): string {
  return CORES[indice(nivel)]
}

export function formatarValidade(data: string | null): string {
  if (!data) return 'atual'
  const [, m, d] = data.slice(0, 10).split('-')
  return `válida até ${d}/${m}`
}
