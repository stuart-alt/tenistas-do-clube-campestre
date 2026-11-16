import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SalaPage from './SalaPage'

const vagas = [
  { posicao: 1, jogador_id: 'ana', nome: 'Ana', foto_url: null },
  { posicao: 3, jogador_id: 'bruno', nome: 'Bruno', foto_url: null },
]
let sala: Record<string, unknown> | null
let usuario = 'carla'
let admin = false
const rpc = vi.fn()
const buscar = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => {
            buscar()
            return Promise.resolve({ data: sala, error: null })
          },
        }),
      }),
    }),
  },
}))
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ perfil: { id: usuario, is_admin: admin } }) }))

function montar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/salas/s1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/salas/:id" element={<SalaPage />} />
          <Route path="/salas" element={<p>lista</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  rpc.mockReset()
  buscar.mockReset()
  usuario = 'carla'
  admin = false
  sala = {
    id: 's1',
    criador: 'ana',
    modalidade: 'duplas',
    data_hora: new Date(Date.now() + 86400000).toISOString(),
    recado: null,
    status: 'aberta',
    partida_id: null,
    vagas,
  }
})

test('mostra duplas, ocupantes e botões Entrar aqui nas vagas livres', async () => {
  montar()
  expect(await screen.findByText('Dupla 1')).toBeInTheDocument()
  expect(screen.getByText('Dupla 2')).toBeInTheDocument()
  expect(screen.getByText('Ana')).toBeInTheDocument()
  expect(screen.getByText('Bruno')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Entrar aqui' })).toHaveLength(2)
})

test('entrar na vaga 4 chama a RPC', async () => {
  rpc.mockResolvedValue({ error: null })
  montar()
  const botoes = await screen.findAllByRole('button', { name: 'Entrar aqui' })
  await userEvent.click(botoes[1])
  expect(rpc).toHaveBeenCalledWith('entrar_sala', { p_sala: 's1', p_posicao: 4 })
})

test('VAGA_OCUPADA mostra mensagem e recarrega a sala', async () => {
  rpc.mockResolvedValue({ error: { message: 'VAGA_OCUPADA' } })
  montar()
  const botoes = await screen.findAllByRole('button', { name: 'Entrar aqui' })
  const antes = buscar.mock.calls.length
  await userEvent.click(botoes[1])
  expect(await screen.findByText('Essa vaga já foi ocupada.')).toBeInTheDocument()
  await waitFor(() => expect(buscar.mock.calls.length).toBeGreaterThan(antes))
})

test('criador vê Cancelar sala; ocupante vê Sair', async () => {
  usuario = 'ana'
  montar()
  expect(await screen.findByRole('button', { name: 'Cancelar sala' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
})

test('jogador de fora não vê Cancelar nem Sair', async () => {
  montar()
  await screen.findByText('Dupla 1')
  expect(screen.queryByRole('button', { name: 'Cancelar sala' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument()
})

test('sala confirmada já passada mostra Lançar resultado', async () => {
  sala = { ...sala, status: 'confirmada', data_hora: new Date(Date.now() - 3600000).toISOString() }
  montar()
  const link = await screen.findByRole('link', { name: 'Lançar resultado' })
  expect(link).toHaveAttribute('href', '/partidas/nova?sala=s1')
})

test('sala inexistente', async () => {
  sala = null
  montar()
  expect(await screen.findByText('Sala não encontrada ou encerrada.')).toBeInTheDocument()
})

test('administrador não vê Entrar aqui nem Lançar resultado, mas vê Cancelar sala', async () => {
  usuario = 'adm'
  admin = true
  sala = { ...sala, status: 'confirmada', data_hora: new Date(Date.now() - 3600000).toISOString() }
  montar()
  expect(await screen.findByRole('button', { name: 'Cancelar sala' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Entrar aqui' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'Lançar resultado' })).toBeNull()
})

test('administrador não vê Entrar aqui em sala aberta', async () => {
  usuario = 'adm'
  admin = true
  montar()
  await screen.findByText('Dupla 1')
  expect(screen.queryByRole('button', { name: 'Entrar aqui' })).toBeNull()
})
