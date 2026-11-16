export function linkWhatsApp(telefone: string): string | null {
  const d = telefone.replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) return `https://wa.me/55${d}`
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return `https://wa.me/${d}`
  return null
}

const REGEX_CELULAR = /^[1-9]{2}9[0-9]{8}$/

/** Celular brasileiro (DDD + 9 dígitos) só com dígitos, ou null se inválido. */
export function normalizarTelefone(t: string): string | null {
  let d = t.replace(/\D/g, '')
  if (d.length === 13 && d.startsWith('55')) d = d.slice(2)
  return REGEX_CELULAR.test(d) ? d : null
}

export const ERRO_CELULAR = 'Informe um celular com DDD, ex.: (11) 98765-4321'
