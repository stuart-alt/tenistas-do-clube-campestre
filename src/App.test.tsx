import { render, screen } from '@testing-library/react'
import App from './App'
import { supabase } from './lib/supabase'

const PERFIL = { id: 'u1', nome: 'Ana', is_admin: false, foto_url: null }

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() },
    from: vi.fn(),
  },
}))

function preparar(session: unknown, perfil: unknown) {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session } } as never)
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  } as never)
  vi.mocked(supabase.from).mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: perfil }) }) }),
  } as never)
}

function irPara(caminho: string) {
  window.history.pushState({}, '', '/tenistas-do-clube-campestre' + caminho)
}

test('sem sessão, redireciona para a tela de entrar', async () => {
  preparar(null, null)
  irPara('/ranking')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
})

test('admin recarregando /admin continua em /admin', async () => {
  preparar({ user: { id: 'u1' } }, { ...PERFIL, is_admin: true })
  irPara('/admin')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Administração' })).toBeInTheDocument()
})

test('não admin em /admin é levado ao ranking', async () => {
  preparar({ user: { id: 'u1' } }, PERFIL)
  irPara('/admin')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Ranking' })).toBeInTheDocument()
})
