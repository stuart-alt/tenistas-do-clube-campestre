import { corDaCategoria, melhorRanking, notaAtributo, notasDoJogador } from './card'

const FAIXAS: Record<number, [number, number]> = { 1: [20, 39], 2: [40, 59], 3: [60, 74], 4: [75, 89], 5: [90, 99] }

test('cada nível de estrelas fica dentro da faixa', () => {
  for (const [e, [min, max]] of Object.entries(FAIXAS)) {
    for (let i = 0; i < 500; i++) {
      const n = notaAtributo(Number(e), `semente-${i}`)
      expect(n).toBeGreaterThanOrEqual(min)
      expect(n).toBeLessThanOrEqual(max)
    }
  }
})

test('é determinístico e 5 estrelas nunca fica abaixo de 90', () => {
  expect(notaAtributo(3, 'abc')).toBe(notaAtributo(3, 'abc'))
  for (let i = 0; i < 200; i++) expect(notaAtributo(5, `x${i}`)).toBeGreaterThanOrEqual(90)
})

test('estrelas fora de 1..5 são limitadas', () => {
  expect(notaAtributo(0, 's')).toBe(notaAtributo(1, 's'))
  expect(notaAtributo(9, 's')).toBe(notaAtributo(5, 's'))
})

test('sementes diferentes espalham as notas', () => {
  const notas = new Set(Array.from({ length: 50 }, (_, i) => notaAtributo(4, `s${i}`)))
  expect(notas.size).toBeGreaterThan(5)
})

const base = { forehand: 3, backhand: 3, saque: 3, voleio: 3, velocidade: 3, resistencia: 3 }

test('notasDoJogador: ids diferentes dão números diferentes e geral é a média arredondada', () => {
  const a = notasDoJogador({ id: 'a', ...base })
  const b = notasDoJogador({ id: 'b', ...base })
  const chaves = ['FOR', 'BAC', 'SAQ', 'VOL', 'VEL', 'RES'] as const
  expect(chaves.some((k) => a[k] !== b[k])).toBe(true)
  expect(a.geral).toBe(Math.round(chaves.reduce((s, k) => s + a[k], 0) / 6))
  expect(a.FOR).toBe(notaAtributo(3, 'a:forehand'))
  expect(a.RES).toBe(notaAtributo(3, 'a:resistencia'))
})

test('corDaCategoria tem paleta para cada categoria', () => {
  for (const c of ['A', 'B', 'C', 'D'] as const) {
    const p = corDaCategoria(c)
    expect(p.de).toMatch(/^#/)
    expect(p.ate).toMatch(/^#/)
    expect(p.texto).toMatch(/^#/)
  }
})

test('melhorRanking', () => {
  expect(melhorRanking([])).toBe('Sem ranking ainda')
  expect(
    melhorRanking([
      { modalidade: 'simples', posicao: 3, pontos: 412 },
      { modalidade: 'duplas', posicao: 5, pontos: 100 },
    ]),
  ).toBe('Simples: 3º · 412 pts')
  expect(
    melhorRanking([
      { modalidade: 'simples', posicao: 4, pontos: 412 },
      { modalidade: 'duplas', posicao: 2, pontos: 100 },
    ]),
  ).toBe('Duplas: 2º · 100 pts')
  expect(
    melhorRanking([
      { modalidade: 'duplas', posicao: 2, pontos: 100 },
      { modalidade: 'simples', posicao: 2, pontos: 90 },
    ]),
  ).toBe('Simples: 2º · 90 pts')
})
