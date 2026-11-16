import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LancarPartidaPage from './LancarPartidaPage'
import { hojeLocal } from '../lib/datas'

const jogadores = [
  { id: 'ana', nome: 'Ana', foto_url: null, categoria: 'A' },
  { id: 'bruno', nome: 'Bruno', foto_url: null, categoria: 'B' },
  { id: 'carla', nome: 'Carla', foto_url: null, categoria: 'B' },
]
const sala = {
  modalidade: 'simples',
  data_hora: new Date().toISOString(),
  vagas: [
    { posicao: 1, jogador_id: 'ana' },
    { posicao: 2, jogador_id: 'carla' },
  ],
}
const rpc = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: (t: string) => ({
      select: () =>
        t === 'profiles'
          ? { eq: () => Promise.resolve({ data: jogadores, error: null }) }
          : { eq: () => ({ maybeSingle: () => Promise.resolve({ data: sala, error: null }) }) },
    }),
  },
}))
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ perfil: { id: 'ana' } }) }))

function montar(url = '/partidas/nova') {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LancarPartidaPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function definir(rotulo: string, valor: number) {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: String(valor) } })
}

beforeEach(() => rpc.mockReset())

test('data padrão é hoje, com min = hoje-7 e max = hoje', () => {
  montar()
  const campo = screen.getByLabelText(/Data do jogo/) as HTMLInputElement
  const d = new Date()
  d.setDate(d.getDate() - 7)
  expect(campo.value).toBe(hojeLocal())
  expect(campo.max).toBe(hojeLocal())
  expect(campo.min).toBe(hojeLocal(d))
})

test('envia simples com o placar e usa o usuário logado no lado 1', async () => {
  rpc.mockResolvedValue({ data: 'x', error: null })
  montar()
  await screen.findByRole('option', { name: /Bruno/ })
  await userEvent.selectOptions(screen.getByLabelText('Adversário'), 'bruno')
  await userEvent.click(screen.getByRole('button', { name: '+ set' }))
  await userEvent.click(screen.getByRole('button', { name: '+ set' }))
  ;[[6, 4], [3, 6], [6, 2]].forEach(([a, b], i) => {
    definir(`Set ${i + 1} - games do lado 1`, a)
    definir(`Set ${i + 1} - games do lado 2`, b)
  })
  await userEvent.click(screen.getByRole('button', { name: 'Enviar resultado' }))
  await waitFor(() =>
    expect(rpc).toHaveBeenCalledWith('registrar_partida', {
      p_modalidade: 'simples',
      p_data_jogo: hojeLocal(),
      p_lado1: ['ana'],
      p_lado2: ['bruno'],
      p_sets: [
        { l1: 6, l2: 4, stb: false },
        { l1: 3, l2: 6, stb: false },
        { l1: 6, l2: 2, stb: false },
      ],
      p_sala_id: null,
    }),
  )
})

test('mostra erro traduzido do RPC', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'PLACAR_EMPATADO' } })
  montar()
  await screen.findByRole('option', { name: /Bruno/ })
  await userEvent.selectOptions(screen.getByLabelText('Adversário'), 'bruno')
  await userEvent.click(screen.getByRole('button', { name: 'Enviar resultado' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('A partida não pode terminar empatada em sets.')
})

test('com ?sala= os jogadores vêm preenchidos', async () => {
  montar('/partidas/nova?sala=s1')
  await waitFor(() => expect(screen.getByLabelText('Adversário')).toHaveValue('carla'))
})
