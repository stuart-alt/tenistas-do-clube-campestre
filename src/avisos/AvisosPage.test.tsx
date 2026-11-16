import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AvisosPage from './AvisosPage'

const avisos = [
  { id: 'a2', titulo: 'Novo', corpo_md: 'Treino **Sábado**', fixado: false, created_at: '2026-11-15T10:00:00Z' },
  { id: 'a1', titulo: 'Velho fixado', corpo_md: 'regras', fixado: true, created_at: '2026-10-01T10:00:00Z' },
]
let admin = false
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: () => ({ order: () => Promise.resolve({ data: avisos, error: null }) }) }),
    }),
  },
}))
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ perfil: { id: 'u', is_admin: admin } }) }))

function montar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AvisosPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('fixado vem antes de um aviso mais novo e markdown vira strong', async () => {
  admin = false
  montar()
  const titulos = (await screen.findAllByRole('heading', { level: 3 })).map((h) => h.textContent)
  expect(titulos[0]).toContain('Velho fixado')
  expect(titulos[1]).toContain('Novo')
  expect(screen.getByText('Sábado').tagName).toBe('STRONG')
})

test('não admin não vê ações', async () => {
  admin = false
  montar()
  await screen.findByText('Novo')
  expect(screen.queryByText('Novo aviso')).not.toBeInTheDocument()
  expect(screen.queryByText('Editar')).not.toBeInTheDocument()
})

test('admin vê Novo aviso, Editar e Excluir', async () => {
  admin = true
  montar()
  await screen.findByText('Novo')
  expect(screen.getByText('Novo aviso')).toBeInTheDocument()
  expect(screen.getAllByText('Editar')).toHaveLength(2)
  expect(screen.getAllByText('Excluir')).toHaveLength(2)
})
