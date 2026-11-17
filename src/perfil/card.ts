export type Categoria = 'A' | 'B' | 'C' | 'D'
export type LinhaRanking = { modalidade: string; posicao: number; pontos: number }

const FAIXAS: Record<number, [number, number]> = {
  1: [20, 39],
  2: [40, 59],
  3: [60, 74],
  4: [75, 89],
  5: [90, 99],
}

function fnv1a(texto: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function notaAtributo(estrelas: number, semente: string): number {
  const e = Math.min(5, Math.max(1, Math.round(estrelas) || 1))
  const [min, max] = FAIXAS[e]
  return min + (fnv1a(semente) % (max - min + 1))
}

type PerfilNotas = {
  id: string
  forehand: number
  backhand: number
  saque: number
  voleio: number
  velocidade: number
  resistencia: number
}

export type Notas = { FOR: number; BAC: number; SAQ: number; VOL: number; VEL: number; RES: number; geral: number }

export function notasDoJogador(p: PerfilNotas): Notas {
  const n = (chave: keyof Omit<PerfilNotas, 'id'>) => notaAtributo(p[chave], `${p.id}:${chave}`)
  const FOR = n('forehand')
  const BAC = n('backhand')
  const SAQ = n('saque')
  const VOL = n('voleio')
  const VEL = n('velocidade')
  const RES = n('resistencia')
  return { FOR, BAC, SAQ, VOL, VEL, RES, geral: Math.round((FOR + BAC + SAQ + VOL + VEL + RES) / 6) }
}

export const CORES_CATEGORIA: Record<Categoria, { de: string; ate: string; texto: string; destaque: string }> = {
  A: { de: '#f6d365', ate: '#b8860b', texto: '#3b2a00', destaque: '#fff3c4' },
  B: { de: '#e6e9ee', ate: '#8d96a3', texto: '#1f2933', destaque: '#ffffff' },
  C: { de: '#e0a46a', ate: '#8c5a2b', texto: '#2e1a08', destaque: '#ffe4c7' },
  D: { de: '#5fbf7a', ate: '#1f6b3a', texto: '#06240f', destaque: '#d9f7e2' },
}

export function corDaCategoria(cat: Categoria) {
  return CORES_CATEGORIA[cat] ?? CORES_CATEGORIA.D
}

export function melhorRanking(linhas: LinhaRanking[]): string {
  if (linhas.length === 0) return 'Sem ranking ainda'
  const melhor = linhas.reduce((a, b) =>
    b.posicao < a.posicao || (b.posicao === a.posicao && b.modalidade === 'simples' && a.modalidade !== 'simples') ? b : a,
  )
  const nome = melhor.modalidade === 'simples' ? 'Simples' : 'Duplas'
  return `${nome}: ${melhor.posicao}º · ${melhor.pontos} pts`
}
