import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import EntrarPage from './EntrarPage'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: vi.fn() } },
}))

const signIn = vi.mocked(supabase.auth.signInWithPassword)

function Cadastro() {
  const { state } = useLocation()
  return <p>cadastro {JSON.stringify(state)}</p>
}

function montar(state?: unknown) {
  render(
    <MemoryRouter
      initialEntries={[{ pathname: '/entrar', state }]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/entrar" element={<EntrarPage />} />
        <Route path="/salas/abc" element={<p>sala abc</p>} />
        <Route path="/" element={<p>inicio</p>} />
        <Route path="/cadastro" element={<Cadastro />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function entrar() {
  const u = userEvent.setup()
  await u.type(screen.getByLabelText('E-mail'), 'a@b.com')
  await u.type(screen.getByLabelText('Senha'), 'segredo123')
  await u.click(screen.getByRole('button', { name: 'Entrar' }))
}

beforeEach(() => {
  signIn.mockReset()
  signIn.mockResolvedValue({ data: {}, error: null } as never)
})

test('após entrar, volta para a página de origem', async () => {
  montar({ de: { pathname: '/salas/abc', search: '' } })
  await entrar()
  expect(await screen.findByText('sala abc')).toBeInTheDocument()
})

test('sem origem, vai para a raiz', async () => {
  montar()
  await entrar()
  expect(await screen.findByText('inicio')).toBeInTheDocument()
})

test('origem externa é ignorada', async () => {
  montar({ de: { pathname: '//evil.com', search: '' } })
  await entrar()
  expect(await screen.findByText('inicio')).toBeInTheDocument()
})

test('o link de cadastro repassa a origem', async () => {
  montar({ de: { pathname: '/salas/abc', search: '' } })
  await userEvent.click(screen.getByRole('link', { name: 'Cadastre-se' }))
  expect(await screen.findByText(/"pathname":"\/salas\/abc"/)).toBeInTheDocument()
})
