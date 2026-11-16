import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import RankingPage from './RankingPage'

const l = (modalidade: string, jogador_id: string, nome: string, categoria: string, pontos: number, posicao: number) => ({
  modalidade, jogador_id, nome, categoria, pontos, posicao, foto_url: null, vitorias: 1, partidas: 2,
})
let linhas: ReturnType<typeof l>[] = []

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (tabela: string) => ({
      select: () => ({
        eq: (_c: string, modalidade: string) =>
          Promise.resolve({
            data: tabela === 'regras' ? [{ janela_meses: 6 }] : linhas.filter((x) => x.modalidade === modalidade),
            error: null,
          }),
      }),
    }),
  },
}))
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ perfil: { id: 'c' } }) }))

function montar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RankingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  linhas = [
    l('simples', 'p', 'Pedro', 'D', 355, 3),
    l('simples', 'a', 'Ana', 'B', 412, 1),
    l('simples', 'c', 'Carlos', 'A', 398, 2),
    l('duplas', 'a', 'Ana', 'B', 50, 1),
  ]
})

test('simples por padrão, em ordem de posição', async () => {
  montar()
  await screen.findByText('Ana')
  const itens = screen.getAllByRole('link')
  expect(itens.map((i) => within(i).getByRole('heading').textContent)).toEqual(['Ana', 'Carlos', 'Pedro'])
  expect(within(itens[0]).getByText('1')).toBeInTheDocument()
  expect(within(itens[0]).getByText('B')).toBeInTheDocument()
  expect(within(itens[0]).getByText('412')).toBeInTheDocument()
})

test('filtro de categoria mantém a posição real', async () => {
  montar()
  await screen.findByText('Ana')
  await userEvent.selectOptions(screen.getByLabelText('Categoria'), 'D')
  const itens = screen.getAllByRole('link')
  expect(itens).toHaveLength(1)
  expect(within(itens[0]).getByText('Pedro')).toBeInTheDocument()
  expect(within(itens[0]).getByText('3')).toBeInTheDocument()
})

test('aba Duplas', async () => {
  montar()
  await screen.findByText('Ana')
  await userEvent.click(screen.getByRole('tab', { name: 'Duplas' }))
  await screen.findByText('50')
  expect(screen.getAllByRole('link')).toHaveLength(1)
  expect(screen.queryByText('Pedro')).not.toBeInTheDocument()
})

test('lista vazia', async () => {
  linhas = []
  montar()
  expect(await screen.findByText('Nenhuma partida confirmada nos últimos 6 meses.')).toBeInTheDocument()
})
