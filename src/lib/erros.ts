const GENERICO = 'Algo deu errado. Tente novamente.'

const MENSAGENS: Record<string, string> = {
  ADMIN_NAO_JOGA: 'Contas de administrador não participam de jogos.',
  DATA_INVALIDA: 'Data inválida. Use uma data dos últimos 7 dias, até hoje.',
  JA_NA_SALA: 'Você já está nesta sala.',
  JOGADORES_INVALIDOS: 'Jogadores inválidos para este tipo de partida.',
  JOGADOR_NAO_ENCONTRADO: 'Jogador não encontrado.',
  NAO_PARTICIPANTE: 'Você não participa desta partida.',
  PARTIDA_NAO_ENCONTRADA: 'Partida não encontrada.',
  PLACAR_EMPATADO: 'A partida não pode terminar empatada em sets.',
  MENSAGEM_INVALIDA: 'Escreva uma mensagem de até 2000 caracteres.',
  MENSAGEM_NAO_ENCONTRADA: 'Mensagem não encontrada.',
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
  'Auth session missing!': 'Link expirado ou já usado. Peça um novo.',
  'New password should be different from the old password.': 'A nova senha precisa ser diferente da anterior.',
  'Email not confirmed': 'E-mail ainda não confirmado.',
}

const AGUARDE = 'Aguarde um minuto antes de pedir outro e-mail.'

// Mensagens do Auth que trazem números ou variam no texto
const PREFIXOS: [string, string][] = [
  ['For security purposes, you can only request this after', AGUARDE],
  ['Password should be at least', 'A senha precisa ter pelo menos 6 caracteres.'],
]

export function traduzirErro(e: unknown): string {
  const msg =
    typeof e === 'object' && e !== null && 'message' in e
      ? String((e as { message: unknown }).message)
      : typeof e === 'string'
        ? e
        : ''
  if (MENSAGENS[msg]) return MENSAGENS[msg]
  if (msg.includes('profiles_telefone_celular_br')) return 'Informe um celular com DDD, ex.: (11) 98765-4321'
  if (/email rate limit exceeded/i.test(msg)) return AGUARDE
  return PREFIXOS.find(([p]) => msg.startsWith(p))?.[1] ?? GENERICO
}
