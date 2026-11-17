import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import RegrasForm from './RegrasForm'

const rpc = vi.fn()
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }))

const regra = {
  modalidade: 'simples',
  pts_vitoria: 50,
  pts_set: 10,
  pts_game: 1,
  bonus_pct: '0.2',
  bonus_teto: 50,
  janela_meses: 6,
  max_partidas_semana: 2,
}

test('mostra regras e salva após confirmar', async () => {
  rpc.mockResolvedValue({ error: null })
  const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RegrasForm regra={regra} />
    </QueryClientProvider>,
  )
  expect(screen.getByLabelText('Pontos por vitória')).toHaveValue(50)
  expect(screen.getByLabelText('Pontos por set')).toHaveValue(10)
  expect(screen.getByLabelText('Pontos por game')).toHaveValue(1)
  expect(screen.getByLabelText('Bônus (%)')).toHaveValue(20)
  expect(screen.getByLabelText('Teto do bônus')).toHaveValue(50)
  expect(screen.getByLabelText('Janela (meses)')).toHaveValue(6)
  expect(screen.getByLabelText('Partidas por semana que contam no ranking (0 = sem limite)')).toHaveValue(2)

  await userEvent.clear(screen.getByLabelText('Pontos por vitória'))
  await userEvent.type(screen.getByLabelText('Pontos por vitória'), '100')
  await userEvent.clear(screen.getByLabelText('Partidas por semana que contam no ranking (0 = sem limite)'))
  await userEvent.type(screen.getByLabelText('Partidas por semana que contam no ranking (0 = sem limite)'), '3')
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

  expect(confirmar).toHaveBeenCalledWith('Isso vai recalcular todo o ranking de simples. Continuar?')
  expect(rpc).toHaveBeenCalledWith('atualizar_regras', {
    p_modalidade: 'simples',
    p_pts_vitoria: 100,
    p_pts_set: 10,
    p_pts_game: 1,
    p_bonus_pct: 0.2,
    p_bonus_teto: 50,
    p_janela_meses: 6,
    p_max_partidas_semana: 3,
  })
})
