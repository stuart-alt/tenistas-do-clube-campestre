import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EditarPerfilPage from './EditarPerfilPage'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    perfil: { id: 'eu-123', nome: 'Ana', disponibilidade: [] },
    recarregarPerfil: async () => {},
  }),
}))

test('tem link para ver o próprio perfil', () => {
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <EditarPerfilPage />
    </MemoryRouter>,
  )
  expect(screen.getByRole('link', { name: 'Ver meu perfil' })).toHaveAttribute('href', '/jogadores/eu-123')
})
