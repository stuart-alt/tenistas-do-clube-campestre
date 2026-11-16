import { render, screen } from '@testing-library/react'
import App from './App'

test('mostra o título do app', () => {
  render(<App />)
  expect(screen.getByText('Tenistas do Campestre')).toBeInTheDocument()
})
