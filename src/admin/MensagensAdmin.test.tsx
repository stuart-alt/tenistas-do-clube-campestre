import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MensagensAdmin from './MensagensAdmin'

const rpc = vi.hoisted(() => vi.fn())
const msg = (id: string, nome: string, texto: string, resposta: string | null, created_at: string) => ({
  id,
  tipo: 'duvida',
  texto,
  resposta,
  created_at,
  profiles: { nome },
})
// Ordem do banco: mais recentes primeiro; a respondida é a mais nova
const dados = [
  msg('r1', 'Rita', 'Já respondida', 'Feito', '2026-11-17T12:00:00Z'),
  msg('p1', 'Paulo', 'Pendente nova', null, '2026-11-16T12:00:00Z'),
  msg('p2', 'Pedro', 'Pendente antiga', null, '2026-11-15T12:00:00Z'),
]
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc,
    from: () => ({ select: () => ({ order: () => Promise.resolve({ data: dados, error: null }) }) }),
  },
}))

function montar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MensagensAdmin />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  rpc.mockReset()
  rpc.mockResolvedValue({ error: null })
})

test('lista as sem resposta primeiro', async () => {
  montar()
  await screen.findByText('Pendente nova')
  const itens = screen.getAllByRole('listitem')
  expect(itens).toHaveLength(3)
  expect(within(itens[0]).getByText('Pendente nova')).toBeInTheDocument()
  expect(within(itens[0]).getByText(/Paulo/)).toBeInTheDocument()
  expect(within(itens[1]).getByText('Pendente antiga')).toBeInTheDocument()
  expect(within(itens[2]).getByText('Já respondida')).toBeInTheDocument()
  expect(within(itens[2]).getByText('Feito')).toBeInTheDocument()
})

test('responder chama a RPC', async () => {
  montar()
  await screen.findByText('Pendente nova')
  const item = screen.getAllByRole('listitem')[0]
  await userEvent.type(within(item).getByLabelText('Resposta'), 'Vamos ver')
  await userEvent.click(within(item).getByRole('button', { name: 'Responder' }))
  expect(rpc).toHaveBeenCalledWith('responder_mensagem_admin', { p_id: 'p1', p_resposta: 'Vamos ver' })
})
