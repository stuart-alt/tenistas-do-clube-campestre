import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PerfilPage from './PerfilPage'

const exportar = vi.hoisted(() => ({
  svgParaPng: vi.fn(),
  fotoComoDataUrl: vi.fn(),
  compartilharOuBaixar: vi.fn(),
}))
vi.mock('./exportarCard', () => exportar)

const jogador = {
  id: 'eu-1', nome: 'Ana Lima', categoria: 'B', genero: 'feminino', foto_url: null as string | null, telefone: '11987654321',
  data_nascimento: '1990-05-20', disponibilidade: [], is_admin: false,
  forehand: 3, backhand: 3, saque: 3, voleio: 3, velocidade: 3, resistencia: 3,
}
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: async () => ({ data: [], error: null }),
    from: (tabela: string) => {
      const res = {
        profiles: { data: jogador, error: null },
        ranking: { data: [{ modalidade: 'simples', posicao: 2, pontos: 80 }], error: null },
      }[tabela] ?? { data: [], error: null }
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'order', 'limit']) q[m] = () => q
      q.maybeSingle = async () => res
      q.then = (ok: (v: unknown) => unknown) => Promise.resolve(res).then(ok)
      return q
    },
  },
}))
let eu = { id: 'eu-1', is_admin: false }
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ perfil: eu }) }))

function montar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/jogadores/eu-1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes><Route path="/jogadores/:id" element={<PerfilPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(async () => {
  await screen.findByText('Nenhuma partida confirmada.')
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Gerando...' })).toBeNull())
})

beforeEach(() => {
  eu = { id: 'eu-1', is_admin: false }
  Object.values(exportar).forEach((f) => f.mockReset())
  exportar.fotoComoDataUrl.mockResolvedValue(undefined)
  exportar.svgParaPng.mockResolvedValue(new Blob(['x']))
  exportar.compartilharOuBaixar.mockResolvedValue(undefined)
})

test('perfil próprio mostra o card e exporta', async () => {
  montar()
  const botao = await screen.findByRole('button', { name: 'Exportar card' })
  await userEvent.click(botao)
  await waitFor(() => expect(exportar.compartilharOuBaixar).toHaveBeenCalledWith(expect.any(Blob), 'card-ana.png'))
  expect(exportar.svgParaPng).toHaveBeenCalled()
})

test('erro na exportação mostra mensagem amigável', async () => {
  exportar.svgParaPng.mockRejectedValue(new Error('x'))
  montar()
  await userEvent.click(await screen.findByRole('button', { name: 'Exportar card' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível gerar a imagem.')
})

function semEstrelas() {
  expect(screen.queryByText('Habilidades')).not.toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Forehand' })).not.toBeInTheDocument()
  expect(screen.queryByText('★')).not.toBeInTheDocument()
}

test('perfil próprio mostra o card e não mostra estrelas', async () => {
  montar()
  expect(await screen.findByRole('img', { name: 'Card de Ana Lima' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Exportar card' })).toBeInTheDocument()
  expect(screen.getAllByRole('img', { name: /^Card de/ })).toHaveLength(1)
  semEstrelas()
})

test('perfil de outro jogador mostra o card sem exportar e sem estrelas', async () => {
  eu = { id: 'outro', is_admin: false }
  montar()
  const card = await screen.findByRole('img', { name: 'Card de Ana Lima' })
  expect(card).toHaveTextContent('CAT B')
  for (const r of ['FOR', 'BAC', 'SAQ', 'VOL', 'VEL', 'RES']) expect(card).toHaveTextContent(r)
  expect(screen.getByRole('heading', { name: 'Card' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Exportar card' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('img', { name: /^Card de/ })).toHaveLength(1)
  semEstrelas()
})

test('perfil de admin aberto direto não mostra card nem estrelas', async () => {
  eu = { id: 'eu-1', is_admin: true }
  jogador.is_admin = true
  try {
    montar()
    await screen.findByText('Ana Lima')
    expect(screen.queryByRole('img', { name: /^Card de/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Exportar card' })).not.toBeInTheDocument()
    semEstrelas()
    await screen.findByText('Nenhuma partida confirmada.')
  } finally {
    jogador.is_admin = false
  }
})

test('foto que falha ao carregar exporta o card com iniciais', async () => {
  jogador.foto_url = 'https://exemplo.test/foto.jpg'
  exportar.fotoComoDataUrl.mockResolvedValue(undefined)
  try {
    montar()
    const botao = await screen.findByRole('button', { name: 'Exportar card' })
    await waitFor(() => expect(botao).toBeEnabled())
    await userEvent.click(botao)
    await waitFor(() => expect(exportar.svgParaPng).toHaveBeenCalled())
    const svg = exportar.svgParaPng.mock.calls[0][0] as SVGSVGElement
    expect(svg.querySelector('image')).toBeNull()
    expect(svg.textContent).toContain('AL')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exportar card' })).toBeEnabled())
    await screen.findByText('Nenhuma partida confirmada.')
  } finally {
    jogador.foto_url = null
  }
})
