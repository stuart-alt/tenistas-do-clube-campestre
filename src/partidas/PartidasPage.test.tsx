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

const consulta = vi.hoisted(() => ({ select: '', eq: [] as [string, string][] }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: (s: string) => {
        consulta.select = s
        const b = {
          eq: (c: string, v: string) => {
            consulta.eq.push([c, v])
            return b
          },
          order: () => b,
          then: (ok: (r: unknown) => void) => ok({ data: partidas, error: null }),
        }
        return b
      },
    }),
  },
}))
let perfilAtual: Record<string, unknown> = { id: 'ana' }
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ perfil: perfilAtual }) }))

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

test('filtra no servidor as partidas do usuário', async () => {
  consulta.eq = []
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PartidasPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await screen.findByText('Aguardando sua confirmação')
  expect(consulta.select).toContain('eu:partida_jogadores!inner(jogador_id)')
  expect(consulta.eq).toContainEqual(['eu.jogador_id', 'ana'])
})

function montar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PartidasPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('jogador vê o botão Lançar resultado; administrador não', async () => {
  perfilAtual = { id: 'ana' }
  montar()
  expect(await screen.findByRole('link', { name: 'Lançar resultado' })).toBeInTheDocument()
})

test('administrador não vê o botão Lançar resultado', async () => {
  perfilAtual = { id: 'adm', is_admin: true }
  montar()
  await screen.findByText('Aguardando sua confirmação')
  expect(screen.queryByRole('link', { name: 'Lançar resultado' })).toBeNull()
  perfilAtual = { id: 'ana' }
})
