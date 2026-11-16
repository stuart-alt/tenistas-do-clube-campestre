const dois = (n: number) => String(n).padStart(2, '0')

export function hojeLocal(agora: Date = new Date()): string {
  return `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}`
}

export function formatarData(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export function idadeEm(nascimentoIso: string, hoje: string): number {
  const [a, m, d] = nascimentoIso.slice(0, 10).split('-').map(Number)
  const [ha, hm, hd] = hoje.slice(0, 10).split('-').map(Number)
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0)
}
