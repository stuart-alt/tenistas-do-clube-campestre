import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PartidasPage from './PartidasPage'

const jog = (id: string, lado: number, nome: string) => ({ jogador_id: id, lado, profiles: { nome, foto_url: null } })
const base = {
  modalidade: 'simples',
  data_jogo: '2026-11-15',
  motivo_contestacao: null,
  created_at: new Date().toISOString(),
  partida_sets: [{ ordem: 1, games_lado1: 6, games_lado2: 4, super_tiebreak: false }],
  pontos_partida: [],
  status: 'pendente',
}
const partidas = [
  { ...base, id: 'p1', lancado_por: 'bruno', partida_jogadores: [jog('bruno', 1, 'Bruno'), jog('ana', 2, 'Ana')] },
  { ...base, id: 'p2', lancado_por: 'ana', partida_jogadores: [jog('ana', 1, 'Ana'), jog('carla', 2, 'Carla')] },
]

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({ order: () => Promise.resolve({ data: partidas, error: null }) }),
      }),
    }),
  },
}))
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ perfil: { id: 'ana' } }) }))

test('separa pendentes por quem precisa confirmar', async () => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PartidasPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await screen.findByText('Aguardando sua confirmação')
  const minha = screen.getByText('Aguardando sua confirmação').closest('section')!
  const outro = screen.getByText('Aguardando o adversário').closest('section')!
  expect(within(minha).getByText(/Bruno/)).toBeInTheDocument()
  expect(within(minha).getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
  expect(within(minha).getByRole('button', { name: 'Contestar' })).toBeInTheDocument()
  expect(within(minha).queryByText(/Carla/)).toBeNull()
  expect(within(outro).getByText(/Carla/)).toBeInTheDocument()
  expect(within(outro).getByText(/confirma automaticamente em 48h/)).toBeInTheDocument()
})
