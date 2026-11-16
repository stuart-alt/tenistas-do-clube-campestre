import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InstalarBanner from './InstalarBanner'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

function mockMatchMedia(standalone: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: standalone && q.includes('standalone'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  localStorage.clear()
  mockMatchMedia(false)
})
afterEach(() => vi.restoreAllMocks())

test('iOS não instalado mostra instruções', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE)
  render(<InstalarBanner />)
  expect(screen.getByText(/Compartilhar/)).toBeInTheDocument()
  expect(screen.getByText(/Adicionar à Tela de Início/)).toBeInTheDocument()
})

test('instalado não renderiza', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE)
  mockMatchMedia(true)
  const { container } = render(<InstalarBanner />)
  expect(container).toBeEmptyDOMElement()
})

test('Android com beforeinstallprompt mostra botão que chama prompt()', async () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ANDROID)
  render(<InstalarBanner />)
  const prompt = vi.fn().mockResolvedValue(undefined)
  act(() => {
    const ev = new Event('beforeinstallprompt')
    Object.assign(ev, { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) })
    window.dispatchEvent(ev)
  })
  await userEvent.click(screen.getByRole('button', { name: 'Instalar app' }))
  expect(prompt).toHaveBeenCalled()
})

test('"Agora não" esconde e grava em localStorage', async () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE)
  const { container } = render(<InstalarBanner />)
  await userEvent.click(screen.getByRole('button', { name: 'Agora não' }))
  expect(container).toBeEmptyDOMElement()
  expect(localStorage.length).toBe(1)
})
