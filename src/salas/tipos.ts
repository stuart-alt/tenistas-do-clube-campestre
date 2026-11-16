export type Vaga = { posicao: number; jogador_id: string; nome: string; foto_url: string | null }
export type SalaLista = {
  id: string
  criador: string
  modalidade: string
  data_hora: string
  recado: string | null
  status: string
  partida_id: string | null
  vagas: Vaga[] | null
}

export const totalVagas = (modalidade: string) => (modalidade === 'duplas' ? 4 : 2)

export function formatarDiaHora(iso: string) {
  const d = new Date(iso)
  return {
    dia: d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }),
    hora: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  }
}
