export function linkWhatsApp(telefone: string): string | null {
  const d = telefone.replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) return `https://wa.me/55${d}`
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return `https://wa.me/${d}`
  return null
}
