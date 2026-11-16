export const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const
export const PERIODOS = ['manha', 'tarde', 'noite'] as const

export type Dia = (typeof DIAS)[number]
export type Periodo = (typeof PERIODOS)[number]

export const ROTULO_DIA: Record<Dia, string> = {
  seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb', dom: 'Dom',
}
export const ROTULO_PERIODO: Record<Periodo, string> = {
  manha: 'Manhã', tarde: 'Tarde', noite: 'Noite',
}

export function slot(dia: Dia, periodo: Periodo): string {
  return `${dia}_${periodo}`
}

export function emComum(a: string[], b: string[]): number {
  const conjunto = new Set(b)
  return [...new Set(a)].filter((s) => conjunto.has(s)).length
}
