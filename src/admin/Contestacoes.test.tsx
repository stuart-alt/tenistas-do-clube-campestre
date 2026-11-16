import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Contestacoes from './Contestacoes'

const jog = (id: string, lado: number, nome: string) => ({ jogador_id: id, lado, profiles: { nome, foto_url: null } })
const base = {
  modalidade: 'simples',
  data_jogo: '2026-11-15',
  motivo_contestacao: null,
  created_at: '2026-11-15T12:00:00Z',
  lancado_por: 'ana',
  partida_sets: [{ ordem: 1, games_lado1: 6, games_lado2: 4, super_tiebreak: false }],
  pontos_partida: [],
}
const recente = { ...base, id: 'p1', status: 'contestada', partida_jogadores: [jog('ana', 1, 'Ana'), jog('bia', 2, 'Bia')] }
const outra = { ...base, id: 'p2', status: 'confirmada', partida_jogadores: [jog('ana', 1, 'Ana'), jog('cris', 2, 'Cris')] }
const antiga = {
  ...base,
  id: 'p3',
  data_jogo: '2025-01-10',
  status: 'contestada',
  partida_jogadores: [jog('davi', 1, 'Davi'), jog('eva', 2, 'Eva')],
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => {
        const filtros: Record<string, string> = {}
        const b = {
          eq: (c: string, v: string) => {
            filtros[c] = v
            return b
          },
          order: () => b,
          limit: () => b,
          then: (ok: (r: unknown) => void) =>
            ok({
              // A busca geral (últimas 200) não alcança a contestação antiga
              data: filtros.status === 'contestada' ? [recente, antiga] : [recente, outra],
              error: null,
            }),
        }
        return b
      },
    }),
  },
}))

function montar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Contestacoes />
    </QueryClientProvider>,
  )
}

test('lista contestadas fora das últimas 200 partidas', async () => {
  montar()
  const secao = (await screen.findByText('Contestadas')).closest('section')!
  expect(within(secao).getByText(/Davi/)).toBeInTheDocument()
  expect(within(secao).getByText(/Bia/)).toBeInTheDocument()
  expect(within(secao).queryByText(/Cris/)).toBeNull()
})

test('busca não repete as contestadas', async () => {
  montar()
  await screen.findByText('Contestadas')
  await userEvent.type(screen.getByLabelText('Buscar partida por jogador'), 'ana')
  const busca = screen.getByText('Buscar partida').closest('section')!
  expect(within(busca).getByText(/Cris/)).toBeInTheDocument()
  expect(within(busca).queryByText(/Bia/)).toBeNull()
})
