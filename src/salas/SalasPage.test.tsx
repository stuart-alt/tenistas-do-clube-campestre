import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SalasPage from './SalasPage'
import NovaSalaPage from './NovaSalaPage'

let admin = false
let salas: unknown[] = []
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ order: () => Promise.resolve({ data: salas, error: null }) }) }),
  },
}))
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ perfil: { id: 'eu', is_admin: admin } }) }))

function montar(el: React.ReactNode) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{el}</MemoryRouter>
    </QueryClientProvider>,
  )
}

const vaga = (posicao: number, id: string) => ({ posicao, jogador_id: id, nome: id, foto_url: null })
const sala = (id: string, modalidade: string, status: string, vagas: ReturnType<typeof vaga>[], recado: string) => ({
  id,
  criador: 'x',
  modalidade,
  status,
  partida_id: null,
  recado,
  data_hora: '2026-11-20T18:00:00Z',
  vagas,
})

beforeEach(() => {
  admin = false
  salas = []
})

test('jogador vê Criar sala', async () => {
  montar(<SalasPage />)
  expect(await screen.findByRole('link', { name: 'Criar sala' })).toBeInTheDocument()
})

test('administrador não vê Criar sala', async () => {
  admin = true
  montar(<SalasPage />)
  await screen.findByText('Nenhuma sala aberta.')
  expect(screen.queryByRole('link', { name: 'Criar sala' })).toBeNull()
})

test('administrador vê aviso em vez do formulário de nova sala', () => {
  admin = true
  montar(<NovaSalaPage />)
  expect(screen.getByText('Contas de administrador não participam de jogos.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Criar sala' })).toBeNull()
})

function comSalas() {
  salas = [
    sala('s1', 'duplas', 'aberta', [vaga(1, 'eu'), vaga(2, 'b'), vaga(3, 'c')], 'Sala minha'),
    sala('s2', 'simples', 'aberta', [vaga(1, 'b')], 'Sala alheia'),
    sala('s3', 'simples', 'confirmada', [vaga(1, 'eu'), vaga(2, 'b')], 'Sala cheia'),
  ]
}

test('mostra o status de cada sala', async () => {
  comSalas()
  montar(<SalasPage />)
  expect(await screen.findAllByText(/Aguardando jogadores \(falta 1 vaga\)/)).toHaveLength(2)
  expect(screen.getByText(/Confirmada/)).toBeInTheDocument()
})

test('rótulo de vagas no plural', async () => {
  salas = [sala('s4', 'duplas', 'aberta', [vaga(1, 'b')], 'Quase vazia')]
  montar(<SalasPage />)
  expect(await screen.findByText(/Aguardando jogadores \(faltam 3 vagas\)/)).toBeInTheDocument()
})

test('Minhas filtra pelas salas em que o usuário está', async () => {
  comSalas()
  montar(<SalasPage />)
  expect(await screen.findByText('Sala alheia')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByRole('button', { name: 'Minhas' }))
  expect(screen.getByText('Sala minha')).toBeInTheDocument()
  expect(screen.getByText('Sala cheia')).toBeInTheDocument()
  expect(screen.queryByText('Sala alheia')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Todas' }))
  expect(screen.getByText('Sala alheia')).toBeInTheDocument()
})

test('Minhas sem salas mostra estado vazio', async () => {
  salas = [sala('s2', 'simples', 'aberta', [vaga(1, 'b')], 'Sala alheia')]
  montar(<SalasPage />)
  await screen.findByText('Sala alheia')
  await userEvent.click(screen.getByRole('button', { name: 'Minhas' }))
  expect(screen.getByText('Você não está em nenhuma sala.')).toBeInTheDocument()
})
