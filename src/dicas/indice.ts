export type ItemDica = { numero: string; titulo: string; pagina: number }
export type Secao = { titulo: string; cor: string; pagina?: number; itens: ItemDica[] }

const i = (numero: string, titulo: string, pagina: number): ItemDica => ({ numero, titulo, pagina })

export const SECOES: Secao[] = [
  {
    titulo: 'Para começar',
    cor: '#0F2A1E',
    itens: [i('', 'Como ler os diagramas', 3), i('', '8 regras de ouro', 4)],
  },
  {
    titulo: '1. Saque',
    cor: '#1D4ED8',
    pagina: 5,
    itens: [
      i('1.1', 'Saque aberto', 6),
      i('1.2', 'Saque fechado (no T)', 7),
      i('1.3', 'Saque no corpo', 8),
      i('1.4', '2º saque com kick no backhand', 9),
      i('1.5', 'Saque + 1: forehand inside-out', 10),
      i('1.6', 'Saque + 1: contra-pé', 11),
      i('1.7', 'Saque e voleio', 12),
      i('1.8', 'Saque nos pontos importantes', 13),
    ],
  },
  {
    titulo: '2. Devolução',
    cor: '#7C3AED',
    pagina: 14,
    itens: [
      i('2.1', 'Devolução do 1º saque: bloqueio', 15),
      i('2.2', 'Atacar o 2º saque', 16),
      i('2.3', 'Devolução cruzada de segurança', 17),
      i('2.4', 'Chip & charge', 18),
      i('2.5', 'Devolução + 1', 19),
      i('2.6', 'Posição contra kick e slice', 20),
    ],
  },
  {
    titulo: '3. Trocas de fundo',
    cor: '#047857',
    pagina: 21,
    itens: [
      i('3.1', 'Cruzada de forehand para construir', 22),
      i('3.2', 'Cruzada de backhand com paciência', 23),
      i('3.3', 'Forehand inside-out no backhand', 24),
      i('3.4', 'Forehand inside-in', 25),
      i('3.5', 'Quando mudar de direção', 26),
      i('3.6', 'Abrir com ângulo e fechar do outro lado', 27),
      i('3.7', 'Fundo no meio para neutralizar', 28),
      i('3.8', 'Bola alta com topspin', 29),
      i('3.9', 'Slice baixo para quebrar o ritmo', 30),
      i('3.10', 'Curtinha depois de empurrar para trás', 31),
    ],
  },
  {
    titulo: '4. Rede e transição',
    cor: '#C2410C',
    pagina: 32,
    itens: [
      i('4.1', 'Aproximação na paralela + voleio cruzado', 33),
      i('4.2', 'Aproximação no meio', 34),
      i('4.3', 'Voleio em dois tempos', 35),
      i('4.4', 'Smash', 36),
      i('4.5', 'Passada em dois tempos', 37),
      i('4.6', 'Lob defensivo e ofensivo', 38),
      i('4.7', 'Responder à curtinha', 39),
      i('4.8', 'Quando o adversário sobe à rede', 40),
    ],
  },
  {
    titulo: '5. Duplas',
    cor: '#BE123C',
    pagina: 41,
    itens: [
      i('5.1', 'Posicionamento básico', 42),
      i('5.2', 'Saque + poach combinado', 43),
      i('5.3', 'I-formation', 44),
      i('5.4', 'Formação australiana', 45),
      i('5.5', 'Devolução cruzada nos pés', 46),
      i('5.6', 'Lob sobre o jogador da rede', 47),
      i('5.7', 'Na dúvida, no meio', 48),
    ],
  },
  {
    titulo: '6. Plano de jogo',
    cor: '#334155',
    pagina: 49,
    itens: [i('6.1', 'Como jogar contra cada adversário', 50), i('6.2', 'Antes e durante o jogo', 51)],
  },
]

export const PAGINA_FONTES = 52
export const TOTAL_PAGINAS = 52

/** Ordem de leitura (anterior/próxima): todas as páginas, menos a 2 (índice do PDF). */
export const ORDEM_PAGINAS: number[] = Array.from({ length: TOTAL_PAGINAS }, (_, k) => k + 1).filter(
  (n) => n !== 2,
)

export function tituloDaPagina(n: number): string {
  if (n === 1) return 'Capa'
  if (n === PAGINA_FONTES) return 'Fontes e leituras'
  for (const s of SECOES) {
    if (s.pagina === n) return `Capítulo ${s.titulo}`
    const item = s.itens.find((x) => x.pagina === n)
    if (item) return item.numero ? `${item.numero} ${item.titulo}` : item.titulo
  }
  return `Página ${n}`
}
