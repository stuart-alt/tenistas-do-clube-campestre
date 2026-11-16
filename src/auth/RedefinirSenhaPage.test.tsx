import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import RedefinirSenhaPage from './RedefinirSenhaPage'
import { useAuth } from './AuthProvider'
import { supabase } from '../lib/supabase'

vi.mock('./AuthProvider', () => ({ useAuth: vi.fn() }))
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { updateUser: vi.fn() } },
}))

const auth = vi.mocked(useAuth)
const updateUser = vi.mocked(supabase.auth.updateUser)

function logado(session: boolean, carregando = false) {
  auth.mockReturnValue({
    session: session ? ({ user: { id: 'u1' } } as never) : null,
    perfil: null,
    carregando,
    recarregarPerfil: async () => {},
  })
}

function renderizar() {
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <RedefinirSenhaPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  updateUser.mockReset()
  window.location.hash = ''
})

test('com sessão de recuperação mostra o formulário', () => {
  logado(true)
  renderizar()
  expect(screen.getByLabelText('Nova senha')).toBeInTheDocument()
})

test('sem sessão após carregar mostra link expirado', () => {
  logado(false)
  renderizar()
  expect(screen.getByText('Link expirado ou já usado.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /novo link/i })).toHaveAttribute('href', '/esqueci-senha')
  expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument()
})

test('enquanto carrega não mostra nada de expirado', () => {
  logado(false, true)
  renderizar()
  expect(screen.queryByText('Link expirado ou já usado.')).not.toBeInTheDocument()
})

test('erro no hash da URL mostra link expirado', () => {
  window.location.hash = '#error=access_denied&error_code=otp_expired'
  logado(true)
  renderizar()
  expect(screen.getByText('Link expirado ou já usado.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument()
})

test('erro do Supabase ao salvar é traduzido', async () => {
  logado(true)
  updateUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'New password should be different from the old password.' },
  } as never)
  renderizar()
  const u = userEvent.setup()
  await u.type(screen.getByLabelText('Nova senha'), 'segredo123')
  await u.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('A nova senha precisa ser diferente da anterior.')
})
