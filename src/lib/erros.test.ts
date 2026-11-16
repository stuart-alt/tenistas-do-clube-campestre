import { traduzirErro } from './erros'

const CODIGOS = [
  'DATA_INVALIDA', 'JA_NA_SALA', 'JOGADORES_INVALIDOS', 'JOGADOR_NAO_ENCONTRADO',
  'NAO_PARTICIPANTE', 'PARTIDA_NAO_ENCONTRADA', 'PLACAR_EMPATADO', 'POSICAO_INVALIDA',
  'REGRA_INVALIDA', 'SALA_FECHADA', 'SALA_NAO_ENCONTRADA', 'SEM_PERMISSAO', 'SETS_INVALIDOS',
  'SET_EMPATADO', 'STATUS_INVALIDO', 'SUPER_TIEBREAK_NAO_FINAL', 'VAGA_OCUPADA',
]

test('traduz código de regra do banco', () => {
  expect(traduzirErro({ message: 'VAGA_OCUPADA', code: 'P0001' })).toBe('Essa vaga já foi ocupada.')
})

test('todo código conhecido tem frase própria', () => {
  for (const c of CODIGOS) {
    const t = traduzirErro({ message: c })
    expect(t).not.toBe('Algo deu errado. Tente novamente.')
    expect(t).not.toBe(c)
  }
})

test('traduz erros do Auth', () => {
  expect(traduzirErro({ message: 'Invalid login credentials' })).toBe('E-mail ou senha incorretos.')
  expect(traduzirErro({ message: 'User already registered' })).toBe('Este e-mail já está cadastrado.')
})

test('erro desconhecido vira mensagem genérica', () => {
  expect(traduzirErro(new Error('xyz'))).toBe('Algo deu errado. Tente novamente.')
  expect(traduzirErro(null)).toBe('Algo deu errado. Tente novamente.')
})
