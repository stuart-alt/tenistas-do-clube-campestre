import { detectarPlataforma } from './plataforma'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

test('detecta a plataforma pelo user agent', () => {
  expect(detectarPlataforma(IPHONE)).toBe('ios')
  expect(detectarPlataforma(ANDROID)).toBe('android')
  expect(detectarPlataforma(WINDOWS)).toBe('outro')
})

const IPAD_DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'

test('iPadOS (UA de Mac com toque) é ios; Mac sem toque é outro', () => {
  expect(detectarPlataforma(IPAD_DESKTOP, 5)).toBe('ios')
  expect(detectarPlataforma(IPAD_DESKTOP, 0)).toBe('outro')
  expect(detectarPlataforma(IPAD_DESKTOP)).toBe('outro')
})

const LINUX_DESKTOP =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

test('tablet Android em modo desktop (Linux com toque) é android; Linux sem toque é outro', () => {
  expect(detectarPlataforma(LINUX_DESKTOP, 5)).toBe('android')
  expect(detectarPlataforma(LINUX_DESKTOP, 0)).toBe('outro')
})
