import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PartidaCard, { type PartidaDetalhe } from './PartidaCard'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () =>
        Promise.resolve({
          data: [
            { modalidade: 'duplas', max_partidas_semana: 3 },
            { modalidade: 'simples', max_partidas_semana: 2 },
          ],
          error: null,
        }),
    }),
  },
}))

const partida = (conta: boolean): PartidaDetalhe => ({
  id: 'p1',
  modalidade: 'simples',
  data_jogo: '2026-11-15',
  status: 'confirmada',
  lancado_por: 'ana',
  motivo_contestacao: null,
  created_at: '2026-11-15T12:00:00Z',
  partida_jogadores: [
    { jogador_id: 'ana', lado: 1, profiles: { nome: 'Ana', foto_url: null } },
    { jogador_id: 'bruno', lado: 2, profiles: { nome: 'Bruno', foto_url: null } },
  ],
  partida_sets: [{ ordem: 1, games_lado1: 3, games_lado2: 6, super_tiebreak: false }],
  pontos_partida: [
    { jogador_id: 'ana', vitoria: false, pontos: 3, bonus: 0, conta },
    { jogador_id: 'bruno', vitoria: true, pontos: 66, bonus: 0, conta: true },
  ],
})

function montar(p: PartidaDetalhe, euId: string) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PartidaCard partida={p} euId={euId} />
    </QueryClientProvider>,
  )
}

test('avisa quando a partida não contou para o ranking, com o N da modalidade', async () => {
  montar(partida(false), 'ana')
  expect(screen.getByText('Derrota: +3 pts')).toBeInTheDocument()
  expect(
    await screen.findByText('Não contou para o ranking (fora das 2 melhores da semana)'),
  ).toBeInTheDocument()
})

test('não avisa quando a partida contou', () => {
  montar(partida(true), 'ana')
  expect(screen.getByText('Derrota: +3 pts')).toBeInTheDocument()
  expect(screen.queryByText(/Não contou para o ranking/)).toBeNull()
})
