import { ORDEM_PAGINAS, SECOES, tituloDaPagina } from './indice'

const itens = SECOES.flatMap((s) => s.itens)

test('41 padrões numerados e 2 itens de introdução', () => {
  expect(itens.filter((x) => x.numero)).toHaveLength(41)
  expect(itens.filter((x) => !x.numero).map((x) => x.pagina)).toEqual([3, 4])
})

test('capítulos e padrões apontam para as páginas certas', () => {
  expect(SECOES.filter((s) => s.pagina).map((s) => s.pagina)).toEqual([5, 14, 21, 32, 41, 49])
  const por = (n: string) => itens.find((x) => x.numero === n)?.pagina
  expect(por('1.1')).toBe(6)
  expect(por('1.8')).toBe(13)
  expect(por('2.6')).toBe(20)
  expect(por('3.10')).toBe(31)
  expect(por('4.8')).toBe(40)
  expect(por('5.7')).toBe(48)
  expect(por('6.2')).toBe(51)
})

test('ORDEM_PAGINAS exclui a página 2 e tem 51 entradas', () => {
  expect(ORDEM_PAGINAS).toHaveLength(51)
  expect(ORDEM_PAGINAS).not.toContain(2)
  expect(ORDEM_PAGINAS.slice(0, 4)).toEqual([1, 3, 4, 5])
  expect(ORDEM_PAGINAS.at(-1)).toBe(52)
})

test('tituloDaPagina', () => {
  expect(tituloDaPagina(6)).toBe('1.1 Saque aberto')
  expect(tituloDaPagina(14)).toBe('Capítulo 2. Devolução')
  expect(tituloDaPagina(52)).toBe('Fontes e leituras')
})
