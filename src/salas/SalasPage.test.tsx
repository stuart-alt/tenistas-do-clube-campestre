import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SalasPage from './SalasPage'
import NovaSalaPage from './NovaSalaPage'

let admin = false
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
  },
}))
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ perfil: { id: 'u', is_admin: admin } }) }))

function montar(el: React.ReactNode) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{el}</MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  admin = false
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
