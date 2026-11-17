import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ContatoPage from './ContatoPage'

const rpc = vi.hoisted(() => vi.fn())
let mensagens: unknown[] = []
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc,
    from: () => ({ select: () => ({ order: () => Promise.resolve({ data: mensagens, error: null }) }) }),
  },
}))

function montar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ContatoPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  rpc.mockReset()
  rpc.mockResolvedValue({ data: 'id', error: null })
  mensagens = []
})

test('envia a mensagem pela RPC e confirma', async () => {
  montar()
  expect(screen.getByRole('heading', { name: 'Fale com o administrador' })).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'sugestao')
  await userEvent.type(screen.getByLabelText('Mensagem'), 'Mais quadras')
  await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
  expect(rpc).toHaveBeenCalledWith('enviar_mensagem_admin', { p_tipo: 'sugestao', p_texto: 'Mais quadras' })
  expect(
    await screen.findByText('Mensagem enviada. Você será avisado no sininho quando houver resposta.'),
  ).toBeInTheDocument()
})

test('texto vazio bloqueia o envio', async () => {
  montar()
  await userEvent.type(screen.getByLabelText('Mensagem'), '   ')
  expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
  expect(rpc).not.toHaveBeenCalled()
})

test('mostra contador de caracteres', async () => {
  montar()
  await userEvent.type(screen.getByLabelText('Mensagem'), 'abc')
  expect(screen.getByText('3/2000')).toBeInTheDocument()
})

test('lista minhas mensagens com a resposta do administrador', async () => {
  mensagens = [
    { id: 'm1', tipo: 'problema', texto: 'App travou', resposta: 'Já corrigimos', created_at: '2026-11-16T12:00:00Z' },
    { id: 'm2', tipo: 'duvida', texto: 'Como entro?', resposta: null, created_at: '2026-11-15T12:00:00Z' },
  ]
  montar()
  expect(await screen.findByText('Minhas mensagens')).toBeInTheDocument()
  expect(await screen.findByText('App travou')).toBeInTheDocument()
  expect(screen.getByText('Resposta do administrador:')).toBeInTheDocument()
  expect(screen.getByText('Já corrigimos')).toBeInTheDocument()
  expect(screen.getAllByText('Resposta do administrador:')).toHaveLength(1)
})
