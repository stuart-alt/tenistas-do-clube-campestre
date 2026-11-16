import { formatarData, hojeLocal, idadeEm } from './datas'

test('hojeLocal usa os componentes locais, não UTC', () => {
  expect(hojeLocal(new Date(2026, 10, 16, 23, 30))).toBe('2026-11-16')
})

test('formatarData converte ISO para dd/mm/aaaa', () => {
  expect(formatarData('2026-11-05')).toBe('05/11/2026')
})

describe('idadeEm', () => {
  test('antes e depois do aniversário', () => {
    expect(idadeEm('1990-05-20', '2026-05-19')).toBe(35)
    expect(idadeEm('1990-05-20', '2026-05-20')).toBe(36)
  })
})
