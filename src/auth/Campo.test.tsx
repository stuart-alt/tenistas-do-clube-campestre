import { render, screen } from '@testing-library/react'
import { CartaoAuth } from './Campo'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

afterEach(() => vi.restoreAllMocks())

test('telas de entrada mostram como instalar no iPhone', () => {
  localStorage.clear()
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE)
  render(<CartaoAuth titulo="Entrar">conteúdo</CartaoAuth>)
  expect(screen.getByText(/Adicionar à Tela de Início/)).toBeInTheDocument()
  expect(screen.getByText('conteúdo')).toBeInTheDocument()
})
