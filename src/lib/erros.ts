const GENERICO = 'Algo deu errado. Tente novamente.'

const MENSAGENS: Record<string, string> = {
  DATA_INVALIDA: 'Data inválida. Use uma data dos últimos 7 dias, até hoje.',
  JA_NA_SALA: 'Você já está nesta sala.',
  JOGADORES_INVALIDOS: 'Jogadores inválidos para este tipo de partida.',
  JOGADOR_NAO_ENCONTRADO: 'Jogador não encontrado.',
  NAO_PARTICIPANTE: 'Você não participa desta partida.',
  PARTIDA_NAO_ENCONTRADA: 'Partida não encontrada.',
  PLACAR_EMPATADO: 'A partida não pode terminar empatada em sets.',
  POSICAO_INVALIDA: 'Posição inválida.',
  REGRA_INVALIDA: 'Valor de regra inválido.',
  SALA_FECHADA: 'Esta sala está fechada.',
  SALA_NAO_ENCONTRADA: 'Sala não encontrada.',
  SEM_PERMISSAO: 'Você não tem permissão para fazer isso.',
  SETS_INVALIDOS: 'Placar inválido: informe de 1 a 3 sets.',
  SET_EMPATADO: 'Um set não pode terminar empatado.',
  STATUS_INVALIDO: 'Esta ação não é possível no status atual da partida.',
  SUPER_TIEBREAK_NAO_FINAL: 'O super tie-break só pode ser o último set.',
  VAGA_OCUPADA: 'Essa vaga já foi ocupada.',
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'User already registered': 'Este e-mail já está cadastrado.',
}

export function traduzirErro(e: unknown): string {
  const msg =
    typeof e === 'object' && e !== null && 'message' in e
      ? String((e as { message: unknown }).message)
      : typeof e === 'string'
        ? e
        : ''
  return MENSAGENS[msg] ?? GENERICO
}
