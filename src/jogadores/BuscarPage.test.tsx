import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BuscarPage from './BuscarPage'

const base = { foto_url: null, genero: 'masculino', ativo: true }
const jogadores = [
  { ...base, id: 'eu', nome: 'Eu', categoria: 'A', disponibilidade: ['seg_noite', 'sab_manha'] },
  { ...base, id: 'b', nome: 'Bruno', categoria: 'B', disponibilidade: ['dom_tarde'] },
  { ...base, id: 'a', nome: 'Ana', categoria: 'A', disponibilidade: ['seg_noite', 'sab_manha'] },
  { ...base, id: 'c', nome: 'Carla', categoria: 'B', disponibilidade: ['seg_noite'] },
  { ...base, id: 'adm', nome: 'Admin', categoria: 'A', is_admin: true, disponibilidade: ['seg_noite', 'sab_manha'] },
]

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: jogadores, error: null }) }),
    }),
  },
}))
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    perfil: { id: 'eu', disponibilidade: ['seg_noite', 'sab_manha'] },
  }),
}))

function montar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <BuscarPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const nomes = () => screen.getAllByRole('link').map((l) => within(l).getByRole('heading').textContent)

test('ordena por horários em comum e depois nome, sem o próprio usuário', async () => {
  montar()
  await screen.findByText('Ana')
  expect(nomes()).toEqual(['Ana', 'Carla', 'Bruno'])
})

test('administradores não aparecem na lista', async () => {
  montar()
  await screen.findByText('Ana')
  expect(nomes()).not.toContain('Admin')
})

test('filtro de dia e período', async () => {
  montar()
  await screen.findByText('Ana')
  await userEvent.selectOptions(screen.getByLabelText('Dia'), 'sab')
  await userEvent.selectOptions(screen.getByLabelText('Período'), 'manha')
  expect(nomes()).toEqual(['Ana'])
})

test('filtro de categoria', async () => {
  montar()
  await screen.findByText('Ana')
  await userEvent.selectOptions(screen.getByLabelText('Categoria'), 'B')
  expect(nomes()).toEqual(['Carla', 'Bruno'])
})
