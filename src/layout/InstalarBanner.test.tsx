import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InstalarBanner from './InstalarBanner'
import { limparEventoInstalacao } from '../lib/instalacao'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const IPAD =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const IPAD_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Safari/605.1.15'
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
  limparEventoInstalacao()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function dispararInstalacao() {
  const prompt = vi.fn().mockResolvedValue(undefined)
  const ev = new Event('beforeinstallprompt', { cancelable: true })
  Object.assign(ev, { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) })
  window.dispatchEvent(ev)
  return prompt
}

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

test('iOS fora do Safari pede para abrir no Safari', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
  )
  render(<InstalarBanner />)
  expect(screen.getByText('Para instalar, abra este link no Safari.')).toBeInTheDocument()
  expect(screen.queryByText(/Adicionar à Tela de Início/)).not.toBeInTheDocument()
})

test('evento disparado ANTES de montar ainda mostra Instalar app', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ANDROID)
  dispararInstalacao()
  render(<InstalarBanner />)
  expect(screen.getByRole('button', { name: 'Instalar app' })).toBeInTheDocument()
  expect(screen.getByText('Instale o app')).toBeInTheDocument()
})

test('prompt() é chamado no clique e o aviso some após userChoice', async () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ANDROID)
  const prompt = dispararInstalacao()
  const { container } = render(<InstalarBanner />)
  await userEvent.click(screen.getByRole('button', { name: 'Instalar app' }))
  expect(prompt).toHaveBeenCalled()
  expect(container).toBeEmptyDOMElement()
})

test('desktop com evento também oferece instalar', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(WINDOWS)
  dispararInstalacao()
  render(<InstalarBanner />)
  expect(screen.getByRole('button', { name: 'Instalar app' })).toBeInTheDocument()
})

test('Android sem evento: nada no início, instrução manual após 4s', () => {
  vi.useFakeTimers()
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ANDROID)
  const { container } = render(<InstalarBanner />)
  expect(container).toBeEmptyDOMElement()
  act(() => {
    vi.advanceTimersByTime(4000)
  })
  expect(screen.getByText(/abra o menu do navegador \(⋮ ou ☰\)/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Instalar app' })).not.toBeInTheDocument()
})

test('iPad no Safari mostra Compartilhar', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPAD)
  vi.stubGlobal('navigator', Object.create(navigator, { maxTouchPoints: { value: 5 } }))
  render(<InstalarBanner />)
  expect(screen.getByText(/Compartilhar/)).toBeInTheDocument()
})

test('iPad com Chrome pede para abrir no Safari', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPAD_CHROME)
  vi.stubGlobal('navigator', Object.create(navigator, { maxTouchPoints: { value: 5 } }))
  render(<InstalarBanner />)
  expect(screen.getByText('Para instalar, abra este link no Safari.')).toBeInTheDocument()
})

test('desktop sem evento não mostra nada', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(WINDOWS)
  const { container } = render(<InstalarBanner />)
  expect(container).toBeEmptyDOMElement()
})
