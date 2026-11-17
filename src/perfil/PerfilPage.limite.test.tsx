import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PerfilPage from './PerfilPage'

vi.mock('./exportarCard', () => ({ svgParaPng: vi.fn(), fotoComoDataUrl: vi.fn(), compartilharOuBaixar: vi.fn() }))

const jogador = {
  id: 'eu-1', nome: 'Ana Lima', categoria: 'B', genero: 'feminino', foto_url: null, telefone: '11987654321',
  data_nascimento: '1990-05-20', disponibilidade: [],
  forehand: 3, backhand: 3, saque: 3, voleio: 3, velocidade: 3, resistencia: 3,
}
const linha = (id: string, data: string, conta: boolean) => ({
  vitoria: false,
  conta,
  partidas: {
    id,
    modalidade: 'duplas',
    data_jogo: data,
    partida_jogadores: [
      { jogador_id: 'eu-1', lado: 1, profiles: { nome: 'Ana Lima' } },
      { jogador_id: 'b', lado: 2, profiles: { nome: 'Bruno' } },
    ],
    partida_sets: [{ ordem: 1, games_lado1: 3, games_lado2: 6, super_tiebreak: false }],
  },
})
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: async () => ({ data: [], error: null }),
    from: (tabela: string) => {
      const res = {
        profiles: { data: jogador, error: null },
        ranking: { data: [], error: null },
        regras: {
          data: [
            { modalidade: 'simples', max_partidas_semana: 2 },
            { modalidade: 'duplas', max_partidas_semana: 3 },
          ],
          error: null,
        },
        pontos_partida: { data: [linha('p1', '2026-11-10', false), linha('p2', '2026-11-09', true)], error: null },
      }[tabela] ?? { data: [], error: null }
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'order', 'limit']) q[m] = () => q
      q.maybeSingle = async () => res
      q.then = (ok: (v: unknown) => unknown) => Promise.resolve(res).then(ok)
      return q
    },
  },
}))
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ perfil: { id: 'outro', is_admin: false } }) }))

test('últimas partidas: marca a que não contou para o ranking', async () => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/jogadores/eu-1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes><Route path="/jogadores/:id" element={<PerfilPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  expect(
    await screen.findByText('Não contou para o ranking (fora das 3 melhores da semana)'),
  ).toBeInTheDocument()
  expect(screen.getAllByText(/Não contou para o ranking/)).toHaveLength(1)
})
