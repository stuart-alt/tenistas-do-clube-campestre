import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import DicasPage from './DicasPage'
import DicaPage from './DicaPage'

function Local() {
  return <p data-testid="local">{useLocation().pathname}</p>
}

function montar(inicial: string) {
  render(
    <MemoryRouter initialEntries={[inicial]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/dicas" element={<DicasPage />} />
        <Route path="/dicas/:pagina" element={<DicaPage />} />
      </Routes>
      <Local />
    </MemoryRouter>,
  )
}

test('índice tem a linha 1.1 apontando para /dicas/6 e o capítulo para a capa dele', () => {
  montar('/dicas')
  expect(screen.getByRole('link', { name: /1\.1\s*Saque aberto/ })).toHaveAttribute('href', '/dicas/6')
  expect(screen.getByRole('link', { name: '1. Saque' })).toHaveAttribute('href', '/dicas/5')
})

test('página 6 navega para anterior 5 e próxima 7', async () => {
  montar('/dicas/6')
  expect(screen.getByRole('img', { name: '1.1 Saque aberto' })).toHaveAttribute('loading', 'lazy')
  await userEvent.click(screen.getByRole('button', { name: /Próxima/ }))
  expect(screen.getByTestId('local')).toHaveTextContent('/dicas/7')
  await userEvent.click(screen.getByRole('button', { name: /Anterior/ }))
  await userEvent.click(screen.getByRole('button', { name: /Anterior/ }))
  expect(screen.getByTestId('local')).toHaveTextContent('/dicas/5')
})

test('Ampliar alterna para Reduzir', async () => {
  montar('/dicas/6')
  await userEvent.click(screen.getByRole('button', { name: 'Ampliar' }))
  expect(screen.getByRole('button', { name: 'Reduzir' })).toBeInTheDocument()
})

test('primeira página desabilita Anterior', () => {
  montar('/dicas/1')
  expect(screen.getByRole('button', { name: /Anterior/ })).toBeDisabled()
})

test('última página desabilita Próxima', () => {
  montar('/dicas/52')
  expect(screen.getByRole('button', { name: /Próxima/ })).toBeDisabled()
})

test('página 3 tem anterior 1 (pula a 2)', async () => {
  montar('/dicas/3')
  await userEvent.click(screen.getByRole('button', { name: /Anterior/ }))
  expect(screen.getByTestId('local')).toHaveTextContent('/dicas/1')
})

test.each(['/dicas/2', '/dicas/99', '/dicas/abc'])('%s mostra dica não encontrada', (p) => {
  montar(p)
  expect(screen.getByText('Dica não encontrada')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /índice/i })).toHaveAttribute('href', '/dicas')
})
