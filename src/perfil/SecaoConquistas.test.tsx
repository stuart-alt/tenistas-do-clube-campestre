import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Conquistas from './SecaoConquistas'

const dados = vi.hoisted(() => ({
  retrato: [] as unknown[],
  progresso: [] as unknown[],
  sequencia: [{ semanas: 0, jogou_esta_semana: false }] as unknown[],
  rpc: vi.fn(),
}))

const catalogo = [
  { chave: 'sequencia', nome: 'Sequência', emoji: '🔥', descricao: 'Semanas seguidas jogando', unidade: 'semanas', limites: [2, 4, 8, 12], por_modalidade: false, ordem: 1 },
  { chave: 'partidas', nome: 'Partidas', emoji: '🎾', descricao: 'Partidas confirmadas', unidade: 'partidas', limites: [1, 10, 25, 50], por_modalidade: false, ordem: 2 },
  { chave: 'adversarios', nome: 'Enturmado', emoji: '🤝', descricao: 'Adversários diferentes', unidade: 'adversários', limites: [3, 6, 12], por_modalidade: false, ordem: 4 },
  { chave: 'podio', nome: 'Pódio', emoji: '🏆', descricao: 'Top 3 do ranking', unidade: 'posição', limites: [1], por_modalidade: true, ordem: 10 },
]

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (nome: string, args: unknown) => {
      dados.rpc(nome, args)
      const data = nome === 'progresso_conquistas' ? dados.progresso : dados.sequencia
      return Promise.resolve({ data, error: null })
    },
    from: (tabela: string) => {
      const res = { data: tabela === 'conquistas_catalogo' ? catalogo : dados.retrato, error: null }
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'order']) q[m] = () => q
      q.then = (ok: (v: unknown) => unknown) => Promise.resolve(res).then(ok)
      return q
    },
  },
}))

function montar(proprio: boolean) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Conquistas jogadorId="j1" proprio={proprio} />
    </QueryClientProvider>,
  )
}

const linha = (conquista: string, nivel: number, valor: number, valida_ate: string | null, modalidade: string | null = null) => ({
  jogador_id: 'j1', conquista, modalidade, nivel, valor, desde: '2026-10-01', valida_ate, expira_em: null, avisado_vencimento: false,
})

beforeEach(() => {
  dados.retrato = []
  dados.progresso = []
  dados.sequencia = [{ semanas: 0, jogou_esta_semana: false }]
  dados.rpc.mockReset()
})

test('outro jogador: mostra a medalha com nível, valor e validade, sem chamar progresso', async () => {
  dados.retrato = [linha('sequencia', 2, 4, '2027-03-12')]
  montar(false)
  expect(await screen.findByText('Sequência')).toBeInTheDocument()
  expect(screen.getByText('🔥')).toBeInTheDocument()
  expect(screen.getByText('prata')).toBeInTheDocument()
  expect(screen.getByText('4 semanas')).toBeInTheDocument()
  expect(screen.getByText('válida até 12/03')).toBeInTheDocument()
  expect(screen.getByText('Semanas seguidas jogando')).toBeInTheDocument()
  expect(dados.rpc).not.toHaveBeenCalled()
})

test('valor 1 usa a unidade no singular', async () => {
  dados.retrato = [linha('sequencia', 1, 1, '2027-03-12')]
  montar(false)
  expect(await screen.findByText('1 semana')).toBeInTheDocument()
})

test('outro jogador: pódio de nível único mostra Top 3 e atual', async () => {
  dados.retrato = [linha('podio', 1, 2, null, 'simples')]
  montar(false)
  expect(await screen.findByText('Top 3 Simples')).toBeInTheDocument()
  expect(screen.getByText('atual')).toBeInTheDocument()
  expect(screen.queryByText('bronze')).not.toBeInTheDocument()
})

test('outro jogador sem medalhas', async () => {
  montar(false)
  expect(await screen.findByText('Ainda sem medalhas')).toBeInTheDocument()
})

test('próprio: mostra próxima meta com barra de progresso', async () => {
  dados.progresso = [
    { conquista: 'adversarios', modalidade: null, nivel: 0, valor: 2, proximo_limite: 3, valida_ate: null },
  ]
  montar(true)
  expect(await screen.findByText('Enturmado → bronze')).toBeInTheDocument()
  expect(screen.getByText('2/3')).toBeInTheDocument()
  const barra = screen.getByRole('progressbar')
  expect(barra).toHaveAttribute('aria-valuenow', '2')
  expect(barra).toHaveAttribute('aria-valuemax', '3')
})

test('próprio: dica da sequência só quando não jogou esta semana', async () => {
  dados.sequencia = [{ semanas: 3, jogou_esta_semana: false }]
  dados.progresso = [{ conquista: 'sequencia', modalidade: null, nivel: 1, valor: 3, proximo_limite: 4, valida_ate: '2027-03-12' }]
  dados.retrato = [linha('sequencia', 1, 3, '2027-03-12')]
  montar(true)
  expect(await screen.findByText('Jogue esta semana para não quebrar a sequência')).toBeInTheDocument()
})

test('próprio: sem dica quando já jogou esta semana', async () => {
  dados.sequencia = [{ semanas: 3, jogou_esta_semana: true }]
  dados.progresso = [{ conquista: 'sequencia', modalidade: null, nivel: 1, valor: 3, proximo_limite: 4, valida_ate: '2027-03-12' }]
  dados.retrato = [linha('sequencia', 1, 3, '2027-03-12')]
  montar(true)
  expect(await screen.findByText('Sequência → prata')).toBeInTheDocument()
  expect(screen.queryByText('Jogue esta semana para não quebrar a sequência')).not.toBeInTheDocument()
})

test('próprio sem partidas: sem medalhas e lista de metas', async () => {
  dados.progresso = [
    { conquista: 'sequencia', modalidade: null, nivel: 0, valor: 0, proximo_limite: 2, valida_ate: null },
    { conquista: 'partidas', modalidade: null, nivel: 0, valor: 0, proximo_limite: 1, valida_ate: null },
  ]
  montar(true)
  expect(await screen.findByText('Ainda sem medalhas')).toBeInTheDocument()
  expect(await screen.findByText('Sequência → bronze')).toBeInTheDocument()
  expect(screen.getByText('Partidas → bronze')).toBeInTheDocument()
  expect(screen.queryByText('Jogue esta semana para não quebrar a sequência')).not.toBeInTheDocument()
})
