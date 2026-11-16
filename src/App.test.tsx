import { render, screen } from '@testing-library/react'
import App from './App'

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

test('sem sessão, redireciona para a tela de entrar', async () => {
  window.history.pushState({}, '', '/tenistas-do-clube-campestre/ranking')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
})
