import { render, screen } from '@testing-library/react'
import CardJogador from './CardJogador'
import { notasDoJogador } from './card'

const perfil = {
  id: 'p1', nome: 'Beatriz Souza', categoria: 'B' as const, foto_url: null,
  forehand: 4, backhand: 3, saque: 2, voleio: 5, velocidade: 3, resistencia: 1,
}

test('mostra nome, categoria, rótulos e notas', () => {
  const n = notasDoJogador(perfil)
  render(<CardJogador perfil={perfil} ranking={[{ modalidade: 'simples', posicao: 1, pontos: 50 }]} />)
  expect(screen.getByText('Beatriz Souza')).toBeInTheDocument()
  expect(screen.getByText('CAT B')).toBeInTheDocument()
  for (const k of ['FOR', 'BAC', 'SAQ', 'VOL', 'VEL', 'RES'] as const) {
    expect(screen.getByText(k)).toBeInTheDocument()
    expect(screen.getByTestId(`nota-${k}`)).toHaveTextContent(String(n[k]))
  }
  expect(screen.getByTestId('nota-geral')).toHaveTextContent(String(n.geral))
  expect(screen.getByText('Simples: 1º · 50 pts')).toBeInTheDocument()
})

test('sem ranking', () => {
  render(<CardJogador perfil={perfil} ranking={[]} />)
  expect(screen.getByText('Sem ranking ainda')).toBeInTheDocument()
})
