import { mensagemConvite } from './convite'

const URL_BASE = 'https://exemplo.com/app/'

test('duplas com 1 vaga livre', () => {
  const msg = mensagemConvite(
    { id: 's1', modalidade: 'duplas', data_hora: '2026-11-20T22:00:00Z', vagasLivres: 1 },
    URL_BASE,
  )
  expect(msg).toBe(
    [
      '🎾 Bora jogar? Sala de duplas – sex, 20/11 às 19h',
      'Falta 1 vaga. Entre pelo link e garanta a sua:',
      'https://exemplo.com/app/salas/s1',
    ].join('\n'),
  )
})

test('minutos aparecem quando não são zero', () => {
  const msg = mensagemConvite(
    { id: 's2', modalidade: 'simples', data_hora: '2026-11-20T22:30:00Z', vagasLivres: 1 },
    URL_BASE,
  )
  expect(msg.split('\n')[0]).toBe('🎾 Bora jogar? Sala de simples – sex, 20/11 às 19h30')
})

test('plural quando faltam várias vagas', () => {
  const msg = mensagemConvite(
    { id: 's1', modalidade: 'duplas', data_hora: '2026-11-20T22:00:00Z', vagasLivres: 3 },
    URL_BASE,
  )
  expect(msg.split('\n')[1]).toBe('Faltam 3 vagas. Entre pelo link e garanta a sua:')
})
