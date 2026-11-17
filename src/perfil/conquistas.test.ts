import { corNivel, formatarValidade, nomeNivel } from './conquistas'

test('nomeNivel', () => {
  expect([1, 2, 3, 4].map(nomeNivel)).toEqual(['bronze', 'prata', 'ouro', 'diamante'])
})

test('corNivel devolve classes distintas por nível', () => {
  const cores = [1, 2, 3, 4].map(corNivel)
  expect(new Set(cores).size).toBe(4)
})

test('formatarValidade', () => {
  expect(formatarValidade('2027-03-12')).toBe('válida até 12/03')
  expect(formatarValidade(null)).toBe('atual')
})
