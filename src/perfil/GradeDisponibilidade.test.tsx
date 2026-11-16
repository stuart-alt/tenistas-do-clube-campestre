import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GradeDisponibilidade from './GradeDisponibilidade'

test('clicar marca o horário', async () => {
  const onChange = vi.fn()
  render(<GradeDisponibilidade valor={[]} onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'Seg / Noite' }))
  expect(onChange).toHaveBeenCalledWith(['seg_noite'])
})

test('clicar de novo desmarca', async () => {
  const onChange = vi.fn()
  render(<GradeDisponibilidade valor={['seg_noite']} onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'Seg / Noite' }))
  expect(onChange).toHaveBeenCalledWith([])
})

test('sem onChange é somente leitura', () => {
  render(<GradeDisponibilidade valor={['seg_noite']} />)
  expect(screen.queryAllByRole('button')).toHaveLength(0)
})
