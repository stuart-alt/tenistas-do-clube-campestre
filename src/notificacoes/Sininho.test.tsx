import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Sininho from './Sininho'

let contagem = 3
const consulta = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => {
          consulta()
          return new Promise((r) => setTimeout(() => r({ count: contagem, error: null }), 0))
        },
      }),
    }),
  },
}))

function montar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Sininho />
        <Routes>
          <Route path="/notificacoes" element={<p>pagina notificacoes</p>} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('mostra badge com o número de não lidas', async () => {
  contagem = 3
  montar()
  expect(await screen.findByText('3')).toBeInTheDocument()
})

test('sem não lidas não mostra badge', async () => {
  contagem = 0
  montar()
  await waitFor(() => expect(consulta).toHaveBeenCalled())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Notificações' })).toBeInTheDocument())
  expect(screen.queryByText('0')).not.toBeInTheDocument()
})

test('clique navega para /notificacoes', async () => {
  contagem = 1
  montar()
  await userEvent.click(await screen.findByRole('button', { name: /Notificações/ }))
  expect(screen.getByText('pagina notificacoes')).toBeInTheDocument()
})
