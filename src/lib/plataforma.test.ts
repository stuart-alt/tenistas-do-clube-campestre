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
